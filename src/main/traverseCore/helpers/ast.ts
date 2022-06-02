import type { TraverseOptions, NodePath, Visitor, Binding, Scope } from '@babel/traverse';
import generator from '@babel/generator';
import traverse from '@babel/traverse';
import * as _traverse from '@babel/traverse';
import * as t from '@babel/types';
import get from 'lodash/get';
import { reactToVueLifeCycleMap } from './constants/index';

type AST = t.File;
type RootNodePath<T = t.Node> = NodePath<T> & {
  parentPath: NodePath<t.Program>;
};

function isRootNodePath<T = t.Node>(path: NodePath<T>): path is RootNodePath<T> {
  return path.parentPath?.isProgram() ?? false;
}

/**
 * 判断 callExpression 或  OptionalCallExpression
 * @param expression
 * @returns
 */
function isAllCallExpression(expression: t.Node): boolean {
  const isCallExpression = t.isCallExpression(expression);
  const isOptionalCallExpression = t.isOptionalCallExpression(expression);
  if (!isCallExpression && !isOptionalCallExpression) {
    return false;
  }
  return true;
}
/**
 * 判断是否是map函数调用 arr.map or arr?.map
 * @param expression
 * @returns
 */
function isMapCallExpression(expression: t.CallExpression | t.OptionalCallExpression): boolean {
  const callee = expression.callee;
  const args = expression.arguments;
  const isMemberExpression = t.isMemberExpression(callee);
  const isOptionalMemberExpression = t.isOptionalMemberExpression(callee);
  if (!isMemberExpression && !isOptionalMemberExpression) {
    return false;
  }
  if (get(callee, 'property.name') !== 'map') {
    return false;
  }
  const callback = args[0];
  if (!callback) {
    return false;
  }
  if (!t.isArrowFunctionExpression(args[0]) && !t.isFunctionExpression(args[0])) {
    return false;
  }
  return true;
}

function isFunctionReturnStatement({
  functionAstNode,
  returnStatementPath,
}: {
  functionAstNode: t.Node;
  returnStatementPath: NodePath<t.ReturnStatement>;
}): boolean {
  if (t.isReturnStatement(returnStatementPath.node)) {
    const functionStart = get(functionAstNode, 'start');
    const functionEnd = get(functionAstNode, 'end');
    const returnStatementBelongToFunctionStart = get(returnStatementPath, 'parentPath.parentPath.node.start');
    const returnStatementBelongToFunctionEnd = get(returnStatementPath, 'parentPath.parentPath.node.end');
    if (functionStart === returnStatementBelongToFunctionStart && functionEnd === returnStatementBelongToFunctionEnd) {
      return true;
    }
  }
  return false;
}

/**
 * 是否是第一级的return
 * @param param
 * @returns
 */
function isDefaultFunctionReturnStatement({
  functionAstNode,
  returnStatementPath,
}: {
  functionAstNode: t.Node;
  returnStatementPath: NodePath<t.ReturnStatement>;
}): boolean {
  if (t.isReturnStatement(returnStatementPath.node)) {
    // console.log('%c  returnStatementPath.node:', 'color: #0e93e0;background: #aaefe5;', generator(returnStatementPath.node).code);
    const { start: functionStart, end: functionEnd } = functionAstNode;
    let returnStatementBelongToFunctionStart = -1;
    let returnStatementBelongToFunctionEnd = -2;
    const returnParentPath = returnStatementPath.getFunctionParent();
    // console.log('%c  returnParentPath:', 'color: #0e93e0;background: #aaefe5;', generator(returnParentPath.node).code);
    if (returnParentPath?.node && t.isArrowFunctionExpression(returnParentPath.node)) {
      const { start, end } = returnParentPath.node;
      returnStatementBelongToFunctionStart = start;
      returnStatementBelongToFunctionEnd = end;
    } else {
      const { start, end } = get(returnStatementPath, 'parentPath.parentPath.node');
      returnStatementBelongToFunctionStart = start;
      returnStatementBelongToFunctionEnd = end;
    }
    if (functionStart === returnStatementBelongToFunctionStart && functionEnd === returnStatementBelongToFunctionEnd) {
      return true;
    }
  } else if (t.isJSXElement(returnStatementPath.node)) {
    // 直接导出jsx
    const { start: functionStart, end: functionEnd } = functionAstNode;
    const { start, end } = returnStatementPath.node;
    if (functionStart === start && functionEnd === end) {
      return true;
    }
  }
  return false;
}

function functionBodyHasIfStatement(
  functionNode: t.FunctionDeclaration | t.ArrowFunctionExpression | t.FunctionExpression
): boolean {
  if (t.isBlockStatement(functionNode.body)) {
    for (let bodyStatementAst of functionNode.body.body) {
      if (t.isIfStatement(bodyStatementAst)) {
        return true;
      }
    }
    return false;
  }
  return false;
}

function hasJSX(node: any): boolean | t.Node {
  for (let key in node) {
    const item = node[key];
    if (item === 'JSXElement') {
      return true;
    } else if (item && typeof item === 'object') {
      const has = hasJSX(item);
      if (has) {
        return true === has ? has : item;
      }
    }
  }
  return false;
}

/**
 * 是否是this.state 声明
 * @param expressionStatement
 * @returns
 */
const isClassMemberStateExpression = (expressionStatement: t.Node): boolean => {
  if (!t.isExpressionStatement(expressionStatement)) {return false;}
  const name = get(expressionStatement, 'expression.left.property.name');
  return name === 'state';
};

/**
 * 判断是不是react 生命周期函数
 * @param classMethod
 * @returns
 */
const isReactCircleFnInClass = (classMethod: t.Node): boolean => {
  const name = get(classMethod, 'key.name');
  return !!reactToVueLifeCycleMap[name];
};

/**
 * 判断是不是 this.stateState
 * @param path
 * @returns
 */
const isThisSetSate = (node: t.Node) => {
  const calleeName = get(node, 'callee.property.name');
  if (calleeName === 'setState') {
    return true;
  }
  return false;
};

/**
 * 判断是否是函数定义
 * @param path 
 * @returns 
 */
 function isVariableFunc (path:NodePath<any>) {
  let result = false;
  path.traverse({
    ArrowFunctionExpression(){
      result = true;
      path.stop();
    },
    FunctionDeclaration(){

    }
  });
  return result;
}

export * from '@babel/types';
export {
  traverse,
  AST,
  TraverseOptions,
  NodePath,
  Visitor,
  Scope,
  Binding,
  RootNodePath,
  hasJSX,
  isRootNodePath,
  isMapCallExpression,
  isAllCallExpression,
  isFunctionReturnStatement,
  functionBodyHasIfStatement,
  isDefaultFunctionReturnStatement,
  isClassMemberStateExpression,
  isReactCircleFnInClass,
  isThisSetSate,
  isVariableFunc,
};
