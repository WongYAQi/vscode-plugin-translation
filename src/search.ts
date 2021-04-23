/**
 * 搜索功能，要求：输入一段中文，能够查找所有非 dist, 非 node_modules 文本中的符合中文的词条以及所在的文件
 */
import * as vscode from 'vscode'
import fs = require('fs');
import path = require('path')
const transJson = require(path.resolve(__dirname, 'translation.json'))
const mapTranslation: Map<string, translationObject> = new Map()

type translationObject = {
  filepath: string,
  text: string,
  map: Map<string, string>,
  translation: string[]
}

export default function install (context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand('coopwire-translation.search', () => {
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
      if (message.command === 'search') {
        promise.then(() => {
          searchByFilter(message.value, panel)
        })
      }
    }, undefined, context.subscriptions)
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
          map: new Map(),
          translation: []
        }
        const regCurrentFileHasTranslation = /T\(['"](.*?)['"]\)/gm
        let result = regCurrentFileHasTranslation.exec(data)
        while(result) {
          obj.map.set(result[1], transJson[result[1]] || '')
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

function searchByFilter (filter: string, panel: vscode.WebviewPanel) {
  let result: string[] = [];
  ;[...mapTranslation.values()].forEach(obj => {
    if (obj.text.indexOf(filter) > -1) {
      result.push(obj.filepath)
    } else if (obj.translation.some(o => o.indexOf(filter) > -1)) {
      result.push(obj.filepath)
    }
  })
  console.log(result)
  panel.webview.postMessage({
    command: 'searchResult',
    value: result
  })
}