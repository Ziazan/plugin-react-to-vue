import generator from '@babel/generator';
import template from '@babel/template';
import * as babelParser from '@babel/parser';
import * as t from './../helpers/ast';
import get from 'lodash/get';
export * from './template';
export * as tools from './tools';

/*
 * generate BlockStatement
 */
export function getFunctionBody(node, removeBrace = true) {
  let tempAst = babelParser.parse('{console.log(1)}');
  let executed = false;
  let rt;
  t.traverse(tempAst, {
    BlockStatement(tempPath) {
      if (executed) {
        return;
      }
      executed = true;
      tempPath.replaceWith(node);
    },
  });
  rt = generator(tempAst, {});
  rt = rt.code;
  removeBrace && (rt = rt.replace(/^{|}$/g, ''));
  return rt;
}

/**
 * genImportSpecifier
 * @param localName
 * @param importedName
 * @returns
 */
export const genImportSpecifier = (localName: string, importedName?: string) => {
  console.log('%c  importedName:', 'color: #0e93e0;background: #aaefe5;', importedName);
  console.log('%c  localName:', 'color: #0e93e0;background: #aaefe5;', localName);
  const imported = t.identifier(importedName || localName);
  const local = t.identifier(localName);
  return t.importSpecifier(local, imported);
};

/**
 * genImportSpecifier
 * @param localName
 * @param importedName
 * @returns
 */
export const genImportImportDeclaration = (specifiers: any[], sourceStr: string) => {
  const source = t.stringLiteral(sourceStr);
  return t.importDeclaration(specifiers, source);
};

/**
 *  函数 props => const props = defineProps({})
 * @param bodyStatementAst
 */
 export const transFnPropsToVueProps = (functionWithParamsAst: t.Node) => {
  const params = get(functionWithParamsAst, 'params');
  const props = params?.[0] || [];
  const id = t.identifier('props');
  const callee = t.identifier('defineProps');
  let callExpressionArguments: any[] = [];
  if (t.isObjectPattern(props)) {
    //TODO 把props的 字段也传进来
    //{ data, className, type } =》defineProps({ data, className, type })
    const properties = get(props, 'properties') as t.ObjectProperty[];
    callExpressionArguments = [t.objectExpression([...properties])];
    // callExpressionArguments = [...props.properties];
  } else {
    callExpressionArguments = [t.objectExpression([])];
  }
  const callExpression = t.callExpression(callee, callExpressionArguments);

  const variableDeclarator = t.variableDeclarator(id, callExpression);
  return t.variableDeclaration('const', [variableDeclarator]);
};


/**
 * 生成变量声明
 * @param argument
 * @returns
 */
 export const genVariableDeclaration = (variableName:string,expression:string):t.Statement | t.Statement[] => {
  const buildExpressionStatement = template(`
    const %%variableName%% = %%expression%%;
    `);
  return buildExpressionStatement({
    variableName,
    expression,
  });
};

export const genFunctionCallExpression = (name,fnArgument) => {
  const callee = t.identifier(name);
  const expression = t.callExpression(callee, fnArgument);

  return expression;
};