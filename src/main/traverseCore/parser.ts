import * as babelParser from '@babel/parser';
import transformTS from './ts';

const defaultOptions: babelParser.ParserOptions = {
  sourceType: 'module',
  plugins: [
    'jsx',
    'typescript',
    'asyncGenerators',
    'bigInt',
    'classProperties',
    'classPrivateProperties',
    'classPrivateMethods',
    [ 'decorators', { decoratorsBeforeExport: false }],
    'doExpressions',
    'dynamicImport',
    'exportDefaultFrom',
    'exportNamespaceFrom',
    'functionBind',
    'functionSent',
    'importMeta',
    'logicalAssignment',
    'nullishCoalescingOperator',
    'numericSeparator',
    'objectRestSpread',
    'optionalCatchBinding',
    'optionalChaining',
    [ 'pipelineOperator', { proposal: 'minimal' }],
    'throwExpressions',
    'topLevelAwait',
    // 'estree',
  ],
};

export function parseCodeAst(
  code: string,
  userOptions: Partial<babelParser.ParserOptions> = {},
): any {
  const options = {
    ...defaultOptions,
    ...userOptions,
  };
  let ast = babelParser.parse(code, options);
  // if (true) {
  //   ast = transformTS(ast);
  // }

  return ast;
}