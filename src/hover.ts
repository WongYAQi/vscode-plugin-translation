import { HoverProvider } from "vscode";
import * as vscode from 'vscode'
import { commands } from "vscode";
const path = require('path');
const transJson = require('./translation.json')
const regCurrentHasTranslation = /T\(.*?\)/

/**
 * 找到当前行的所有翻译词条
 * @param text 
 */
function getCurrentLineTrans (text: string) {
  let result = []
  let res = regCurrentHasTranslation.exec(text)
  if (res) {
    result.push({ text: res[0], posStart: res.index, posEnd: res.index + res[0].length })
    res = regCurrentHasTranslation.exec(text.substring(res.index + res[0].length))
  }
  return result
}

/**
 * 获取词条，从 T('aaa', aaaa) 或者 T("asd", asdasd) 中拿到词条部分
 * @param text 
 */
function getTranslationLabel (text: string) {
  let firstSingle = text.indexOf('\'')
  let firstDouble = text.indexOf('\"')
  let end = 0
  if (firstSingle === -1) end = text.indexOf('\"', firstDouble + 1) 
  else if (firstDouble === -1) end = text.indexOf('\'', firstSingle + 1)
  else if (firstSingle > firstDouble) end = text.indexOf('\"', firstDouble + 1) 
  else if (firstSingle < firstDouble) end = text.indexOf('\'', firstSingle + 1)
  let label = text.substring(0, end)
  label = label.replace(/^T\(['"]/, '').replace(/\)/, '')
  return label
}
/**
 * 先找到当前鼠标定位的行，然后对鼠标所在的地方进行格式化，得到最近的整个字符串
 * 2. 可不可以触发这个页面中，所有词条的翻译, 不行，每次只能触发当前光标所在的位置的hover provider
 * 3. 创建一个 webview, 显示所有词条被覆盖的内容
 */

export class GoHoverProvider implements HoverProvider {
	public provideHover (
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
	): vscode.Hover | undefined {
    const line = document.lineAt(position.line)
    if (document.fileName.endsWith('.vue')) {
      if (regCurrentHasTranslation.test(line.text)) {
        let arrs = getCurrentLineTrans(line.text)
        let which = arrs.filter(o => o.posStart <= position.character && o.posEnd >= position.character)
        if (which.length) {
          which.sort((a, b) => a.posStart - b.posStart)
          let current = getTranslationLabel(which[0].text)
          console.log(transJson[current])
          return new vscode.Hover(transJson[current])
        }
      }
    } else {

    }
	}
}

export default function install (context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.languages.registerHoverProvider('json', new GoHoverProvider()))
	context.subscriptions.push(vscode.languages.registerHoverProvider('vue', new GoHoverProvider()))
	context.subscriptions.push(vscode.languages.registerHoverProvider('typescript', new GoHoverProvider()))

}
