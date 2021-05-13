/**
 * 搜索功能，要求：输入一段中文，能够查找所有非 dist, 非 node_modules 文本中的符合中文的词条以及所在的文件
 */
import * as vscode from 'vscode'
import fs = require('fs');
import path = require('path')
import { Uri } from 'vscode';
const transJson = require('./translation.json')
const mapTranslation: Map<string, translationObject> = new Map()

type translationObject = {
  /**
   * 文件绝对路径
   */
  filepath: string,
  /**
   * 文件文本
   */
  text: string,
  /**
   * 文件按行分割的文本数组
   */
  texts: string[]
  /**
   * 英文到中文的翻译map
   */
  map: Map<string, string>,
  /**
   * 中文到英文的翻译map
   */
  mapZToE: Map<string, string>,
  /**
   * 当前文件具有的词条翻译结果
   */
  translation: string[]
}

type SearchResult = {
  label: string,
  fileName:  string
  path: string
  children: {
    /**
     * 搜索的文本或者是目标词条
     */
    label:  string
    fileName: string
    line: number
    posStart: number
    posEnd: number
    path: string
    /**
     * 之前的内容
     */
    before: string,
    /**
     * 之后的内容
     */
    after: string,
    translation: string
  }[]
}

export default function install (context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand('coopwire-translation.search', () => {
    try {
    const promise = defaultNormalizeFile()
    const panel = vscode.window.createWebviewPanel(
      'search translation',
      '查询词条',
      vscode.ViewColumn.One,
      {
        enableScripts: true
      }
    )
    panel.webview.html = getWebView()
    panel.webview.onDidReceiveMessage(message => {
      promise.then(() => {
        if (message.command === 'search') {
          let result = searchByFilter(message.value)
          panel.webview.postMessage({
            command: 'searchResult',
            value: result
          })
        } else if (message.command === 'jump') {
          jumpToResultFile(message.value)
        }
      })
    }, undefined, context.subscriptions)
  } catch (err) {
    console.log(err)
  }
	});
  context.subscriptions.push(disposable)
}

/**
 * 
 */
function getWebView () {
  let path2 = path.resolve(__dirname, 'search.html')
  let content = fs.readFileSync(path2, { encoding: 'utf-8' })
  return content
}

/**
 * 遍历当前工作区域所有 .js, .vue 文件，
 * 形成 { fileName: '', translations: new Map(['citiao', 'fanyi']), text: document.getText() }
 * 这样的数据，存储起来，然后每次查询的时候去找
 */
async function defaultNormalizeFile (): Promise<any> {
  let folders = vscode.workspace.workspaceFolders
  if (folders) {
    let url = folders[0].uri.fsPath
    let allFileNames = getFilesNameByFolder(url.toString())
    await getFilesMap(allFileNames)
    console.log(mapTranslation)
  }
}

const extraFoldNames = ['dist', 'node_modules']
const includeSuffix = ['.js', '.vue']
function getFilesNameByFolder (folderUri: string): string[] {
  let files: string[] = []
  let result = fs.readdirSync(folderUri, { withFileTypes: true })
  result.forEach(dirent => {
    if (dirent.isFile()) {
      if (includeSuffix.some(o => dirent.name.endsWith(o))) files.push(path.resolve(folderUri, dirent.name))
    } else if (dirent.isDirectory() && !extraFoldNames.includes(dirent.name)) {
      let tempResult = getFilesNameByFolder(path.resolve(folderUri, dirent.name))
      files.push(...tempResult)
    }
  })
  return files
}


function getFilesMap (files: string[]) {
  let promises = files.map(file => {
    return new Promise<void>((resolve, reject) => {
      let content = fs.readFile(file, { encoding: 'utf-8'}, (err, data) => {
        if (err) reject()
        let obj: translationObject = {
          filepath: file,
          text: data,
          texts: data.split('\n'),
          map: new Map(),
          mapZToE: new Map(),
          translation: []
        }
        const regCurrentFileHasTranslation = /T\(['"](.*?)['"]\)/gm
        let result = regCurrentFileHasTranslation.exec(data)
        while(result) {
          obj.map.set(result[1], transJson[result[1]] || '')
          if (transJson[result[1]]) {
            obj.mapZToE.set(transJson[result[1]], result[1])
          }
          obj.translation.push(transJson[result[1]] || '')
          result = regCurrentFileHasTranslation.exec(data)
        }
        mapTranslation.set(file, obj)
        resolve()
      })
    })
  })
  return Promise.all(promises)
}

/**
 * 搜索结果, 先搜索当前页面是否存在对应的接口，然后查找当前页面存在的词条是否具有翻译
 * @param filter 
 */
function searchByFilter (filter: string) {
  if (!filter.trim()) {
    return []
  }
  let result: SearchResult[] = [];
  let filters: Set<string>= new Set([filter])
  ;[...mapTranslation.values()].forEach(obj => {
    let res: SearchResult = {
      label: obj.filepath.replace(/^.*\\/, ''),
      fileName: obj.filepath.replace(/^.*\\/, ''),
      path: obj.filepath,
      children: []
    }
    for(let key of obj.mapZToE.keys()) {
      if (key.includes(filter)) {
        // 从 texts 中找出所有词条中含有这个结果的
        filters.add(obj.mapZToE.get(key) as string)
      }
    }
    obj.texts.forEach((lineText, ind) => {
      for(let currentFilter of filters) {
        let index = lineText.indexOf(currentFilter)
        if (index > -1) {
          res.children.push({
            label:  currentFilter,
            fileName: res.fileName,
            line: ind + 1,
            posStart: index,
            posEnd: index + currentFilter.length,
            path: res.path,
            before: lineText.substring(0, index).substr(-30),
            after: lineText.substring(index + currentFilter.length).substr(0, 30),
            translation: obj.map.get(currentFilter) || currentFilter
          })
        }
      }
    })
    if (res.children.length) {
      result.push(res)
    }
  })
  return result
}

export async function jumpToResultFile (value: string) {
  let data: SearchResult['children'][0] = JSON.parse(value)
  let textDocument = await vscode.workspace.openTextDocument(Uri.file(data.path))
  let textEditor = await vscode.window.showTextDocument(textDocument)
  let line = textDocument.lineAt(data.line - 1)
  let position = textEditor.selection.active.with(data.line - 1, 0)
  let offset = textDocument.offsetAt(position)
  let startPosition = textDocument.positionAt(offset + data.posStart)
  let selection = new vscode.Selection(startPosition, startPosition)
  textEditor.revealRange(line.range)
  textEditor.selection = selection
}
