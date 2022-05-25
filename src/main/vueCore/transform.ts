import generator from '@babel/generator';
import prettier from 'prettier';
import type { ResultType } from './types/index';
import * as t from './helpers/ast';
import { updateWithJSXElementStatement, hasUnFlattenJSXElementFunctions } from './helpers/template';
import {
  getAllDeclarations,
  genVueTemplate,
  getExportDefaultComponentAst,
  getExportDefaultComponentTemplate,
  genImportImportDeclaration,
} from './utils/index';

interface generateR2SCodeParams {
  sourceAst: any;
  sourceCode: string;
}

export function generateR2SCode({ sourceAst, sourceCode }: generateR2SCodeParams): string {
  // traverse module
  let result: ResultType = {
    importDeclaration: [],
    exportDefaultDeclaration: null,
    variableDeclarations: [],
    declaration: [],
    classDeclarations: [],
    functionDeclarations: [],
    propTypes: {},
    defaultProps: {},
    vueImportSpecifiers: [],
    // there exists incompatibility
    caveats: [],
    source: sourceAst,
  };

  /**
   * 获取文件结构 getAllDeclarations
   */
  const {
    importDeclaration,
    exportDefaultDeclaration,
    exportNamedDeclarations,
    variableDeclarations,
    functionDeclarations,
    classDeclarations,
  } = getAllDeclarations(sourceAst);
  result.importDeclaration = importDeclaration;
  result.exportDefaultDeclaration = exportDefaultDeclaration;
  result.variableDeclarations = variableDeclarations;
  result.functionDeclarations = functionDeclarations;
  result.classDeclarations = classDeclarations;

  //获取导出的ast
  const exportDefaultComponentAst = getExportDefaultComponentAst(result);
  if (!exportDefaultComponentAst) {
    return '';
  }

  const { template: componentTemplate, scriptAsts } = getExportDefaultComponentTemplate(
    {
      exportDefaultComponentAst,
    },
    result
  );
  // 追加vue的导入
  // import {reactive} from vue
  result.vueImportSpecifiers?.length > 0 &&
    scriptAsts.unshift(genImportImportDeclaration(result.vueImportSpecifiers, 'vue'));
  // console.log('%c  template:', 'color: #0e93e0;background: #aaefe5;', scriptAsts);
  // console.log('%c  importDeclaration:', 'color: #0e93e0;background: #aaefe5;', importDeclaration);
  const vueScriptAst = t.program(scriptAsts);
  const componentScriptCode = generator(vueScriptAst).code;

  // const importScript = t.program(importDeclaration);
  // const importScriptCode = generator(importScript).code;

  // 拼接模板
  const vueCode = genVueTemplate({
    template: componentTemplate,
    importScript: importDeclaration,
    script: componentScriptCode,
  });
  //TODO 要换到vue 代码格式化
  return prettier.format(vueCode, {
    parser: 'vue',
    printWidth: 120,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: true,
    jsxSingleQuote: false,
    vueIndentScriptAndStyle: true,
  });
}
