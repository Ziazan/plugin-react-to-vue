import * as t from './../helpers/ast';
import generator from '@babel/generator';
import template from '@babel/template';
import isHtmlTag from './../helpers/is-html-tag';
import get from 'lodash/get';
import set from 'lodash/set';
import { tools } from './index';

export const genVueTemplate = ({ template, importScript, script }) => {
  // root not allow template
  const vueCode = `
        <template>
        ${template}
        </template>
    
        <script setup lang="ts">
        ${importScript}
        ${script}
        </script>
    
        <style lang="less" scoped src="./index.less"></style>
    `;
  return vueCode;
};

export const transformVueTemplate = ({
  node,
  withJSXVariableDeclarations,
  withJSXFunctionDeclarations,
  scriptAsts,
  blockInfo,
}: {
  node: t.Node;
  withJSXVariableDeclarations: any[];
  withJSXFunctionDeclarations: any[];
  scriptAsts: t.Node[];
  blockInfo: any;
}): string => {
  if (t.isJSXElement(node)) {
    let str = '<';
    let tagName = get(node, 'openingElement.name.name');

    // if (!isHtmlTag(tagName)) {
    //   //TODO 自定义标签待实现
    //   let tagComponentAst = null;

    //   for (let functionDeclaration of withJSXFunctionDeclarations) {
    //     if (get(functionDeclaration, 'id.name') === tagName) {
    //       tagComponentAst = functionDeclaration;
    //     }
    //   }

    //   for (let variableDeclaration of withJSXVariableDeclarations) {
    //     for (let declaration of variableDeclaration.declarations) {
    //       if (get(declaration, 'id.name') === tagName) {
    //         tagComponentAst = declaration.init;
    //       }
    //     }
    //   }
    //   return getComponentTemplate({
    //     componentAst: tagComponentAst,
    //     withJSXVariableDeclarations,
    //     withJSXFunctionDeclarations,
    //     scriptAsts,
    //   });
    // }
    str += tagName;

    // 属性
    for (let attr of node.openingElement.attributes) {
      let name = get(attr, 'name.name');
      let value = get(attr, 'value');
      const eventReg = /^on[A-Z]/;
      let attrItemString = ' ';

      //TODO key属性是否不处理
      // if (name === 'key') {
      //   continue;
      // }

      const stringValue = generator(value, { compact: true }).code;
      if (name === 'className') {
        //className => class
        // 替换一下styles.xxx TODO 放在模版代码中replace 还是在这里处理？
        if (t.isJSXExpressionContainer(value)) {
          let valueExpression = get(value, 'expression');
          const stringLiteral = generator(valueExpression).code;
          const expressionArr = stringLiteral.split('.');
          const hasStyles = expressionArr?.[0] === 'styles';
          if (hasStyles) {
            expressionArr.shift();
            attrItemString += `class="${expressionArr.join('.')}"`;
          } else {
            attrItemString += `:class="${tools.changeMemberExpressionByName('')}"`;
          }
        } else {
          attrItemString += `class=${stringValue}`;
        }
      } else if (name === 'dangerouslySetInnerHTML') {
        let htmlIdentifierAst = get(value, 'expression.properties[0].value');
        const htmlIdentifierName = generator(htmlIdentifierAst).code;
        attrItemString += `v-html="${tools.changeMemberExpressionByName(htmlIdentifierName)}"`;
      } else if (/^on[A-Z]/.test(name)) {
        //TODO 需要判断自定义事件
        //函数
        let valueExpression = get(value, 'expression');
        const stringLiteral = tools.changeMemberExpressionByName(generator(valueExpression).code);
        attrItemString += `@${name.slice(2).toLowerCase()}="${stringLiteral}"`;
      } else {
        //值绑定加冒号
        if (t.isJSXExpressionContainer(value) && !/^on[A-Z]/.test(name)) {
          attrItemString += ':';
        }
        attrItemString += name;
        if (value) {
          attrItemString += '=';
          if (t.isJSXExpressionContainer(value)) {
            // attr={expression} => :attr="expression"
            let valueExpression = get(value, 'expression');
            const stringLiteral = tools.changeMemberExpressionByName(generator(valueExpression).code);
            if (t.isCallExpression(valueExpression)) {
              let calleeName = get(valueExpression, 'callee.name');
              if (calleeName === 'require') {
                console.warn(`存在required,需要调整${stringLiteral}`);
              }
            }
            attrItemString += `"${stringLiteral}"`;
          } else {
            attrItemString += stringValue;
          }
        } else {
          //TODO 设置了属性是不是就表示true呢？
          //这里要判断是不是html的原生属性
          attrItemString += `="true"`;
        }
      }
      str += attrItemString;
    }

    // 闭合标签
    if (node.closingElement) {
      str += '>';
      str += node.children
        .map((el) =>
          transformVueTemplate({
            node: el,
            withJSXVariableDeclarations,
            withJSXFunctionDeclarations,
            scriptAsts,
            blockInfo: {},
          })
        )
        .join('');
      str += `</${get(node, 'openingElement.name.name')}>`;
    } else {
      str += '/>';
    }
    return str;
  } else if (t.isJSXText(node)) {
    // 转换成注释
    return node.value || '';
  } else if (t.isJSXExpressionContainer(node)) {
    // 函数表达式

    if (t.isCallExpression(node.expression) || t.isOptionalCallExpression(node.expression)) {
      // 变量或函数调用
      const callName = get(node.expression, 'callee.name');
      if (callName) {
        // 直接调用函数或变量
        let callComponentAst = null;
        for (let functionDeclaration of withJSXFunctionDeclarations) {
          if (get(functionDeclaration, 'id.name') === callName) {
            callComponentAst = functionDeclaration;
          }
        }

        for (let variableDeclaration of withJSXVariableDeclarations) {
          for (let declaration of variableDeclaration.declarations) {
            if (get(declaration, 'id.name') === callName) {
              callComponentAst = declaration.init;
            }
          }
        }

        return getComponentTemplate({
          componentAst: callComponentAst,
          withJSXVariableDeclarations,
          withJSXFunctionDeclarations,
          scriptAsts,
        });
      } else if (t.isMapCallExpression(node.expression)) {
        // map 函数
        const callback = node.expression.arguments[0];
        const callbackParams = get(callback, 'params') || [];
        const calleeNode = get(node.expression, 'callee.object');
        const callbackParamsNames = callbackParams.map((p: any) => p.name);
        //TODO 需要从返回的key上获取
        const keyName = callbackParamsNames?.length === 2 ? callbackParamsNames[1] : '';
        let str = `\n<template v-for="(${callbackParamsNames.join(', ')}) in ${
          generator(calleeNode).code
        }">\n`;
        str += `${getComponentTemplate({
          componentAst: callback,
          withJSXVariableDeclarations,
          withJSXFunctionDeclarations,
          scriptAsts,
        })}`;
        str += '\n</template>\n';
        return str;
      }
    }

    if (t.isTemplateLiteral(node.expression)) {
      // 模板字符串
      const expressions = [];
      for (let expression of node.expression.expressions) {
        expressions.push(generator(expression).code);
      }
      let str = '';
      for (let quasisNode of node.expression.quasis) {
        if (t.isTemplateElement(quasisNode)) {
          const quasisNodeValue = get(quasisNode, 'value.raw');
          if (quasisNodeValue) {
            str += quasisNodeValue;
          } else {
            str += `{{${expressions.shift()}}}`;
          }
        }
      }
      return str;
    }
    if (t.isLogicalExpression(node.expression)) {
      if (get(node.expression, 'operator') === '&&') {
        // 逻辑表达式 {isTrue && <></>}
        // || 渲染 JSXElement 的情况应该不会出现
        let str = `\n<template v-if="${generator(node.expression.left).code}">\n`;
        let childrenJSXElement: any = node.expression.right;
        if (t.isAllCallExpression(node.expression.right)) {
          childrenJSXElement = t.jSXExpressionContainer(node.expression.right);
        }
        str += transformVueTemplate({
          node: childrenJSXElement,
          withJSXVariableDeclarations,
          withJSXFunctionDeclarations,
          scriptAsts,
          blockInfo: {},
        });
        str += '\n</template>\n';
        return str;
      }
    }

    if (t.hasJSX(node)) {
      return transformVueTemplate({
        node: node.expression,
        withJSXVariableDeclarations,
        withJSXFunctionDeclarations,
        scriptAsts,
        blockInfo: {},
      });
    }
    // react 中的注释
    if (t.isJSXEmptyExpression(node.expression)) {
      let commentsText = `<!-- `;
      const innerComments = get(node.expression, 'innerComments');
      innerComments?.map((item) => {
        commentsText += `${item.value}`;
      });
      commentsText += ` -->`;

      return commentsText;
    }

    // t.isIdentifier(node.expression) || t.isMemberExpression(node.expression) 走到这个逻辑
    return `{${generator(node).code}}`;
  } else if (t.isConditionalExpression(node)) {
    let str = `\n<template v-if="${generator(node.test).code}">\n`;
    let childrenJSXElement: any = node.consequent;
    if (t.isReturnStatement(node.consequent)) {
      let argument = get(node.consequent, 'argument');
      if (argument && t.isCallExpression(argument)) {
        childrenJSXElement = t.jSXExpressionContainer(argument);
      } else if (argument) {
        childrenJSXElement = argument;
      }
    } else if (t.isCallExpression(node.consequent)) {
      childrenJSXElement = t.jSXExpressionContainer(node.consequent);
    }
    str += transformVueTemplate({
      node: childrenJSXElement,
      withJSXVariableDeclarations,
      withJSXFunctionDeclarations,
      scriptAsts,
      blockInfo: {},
    });
    str += '\n</template>';
    if (node.alternate) {
      str += '\n<template v-else>\n';
      str += transformVueTemplate({
        node: node.alternate,
        withJSXVariableDeclarations,
        withJSXFunctionDeclarations,
        scriptAsts,
        blockInfo: {},
      });
      str += '\n</template>\n';
    }
    return str;
  } else if (t.isJSXFragment(node)) {
    //支持 <></>
    return node.children
      .map((el) =>
        transformVueTemplate({
          node: el,
          withJSXVariableDeclarations,
          withJSXFunctionDeclarations,
          scriptAsts,
          blockInfo: {},
        })
      )
      .join('');
  }
  return '';
};

export const getComponentTemplate = ({
  componentAst,
  scriptAsts,
  withJSXVariableDeclarations,
  withJSXFunctionDeclarations,
}: {
  componentAst: t.Node;
  scriptAsts: any[];
  withJSXVariableDeclarations: any[];
  withJSXFunctionDeclarations: any[];
}): string => {
  if (t.isJSXElement(componentAst)) {
    return transformVueTemplate({
      node: componentAst,
      withJSXVariableDeclarations,
      withJSXFunctionDeclarations,
      scriptAsts,
      blockInfo: {},
    });
  } else if (t.isReturnStatement(componentAst)) {
    // console.log('%c  [ componentAst ]-36:', 'color: #0e93e0;background: #aaefe5;', generator(componentAst).code);

    const declarationInitAst = get(componentAst, 'argument');
    if (declarationInitAst) {
      return transformVueTemplate({
        node: declarationInitAst,
        withJSXVariableDeclarations,
        withJSXFunctionDeclarations,
        scriptAsts,
        blockInfo: {},
      });
    }
    return '';
  } else if (componentAst) {
    // console.log('%c  [ componentAst ]-37:', 'color: #0e93e0;background: #aaefe5;', generator(componentAst).code);
    // 要判断一下是不是函数
    const { body, params } = componentAst as any;
    const param = params ? params[0] : null;

    let templateAst: any;

    if (t.isBlockStatement(body)) {
      for (let bodyStatementAst of body.body) {
        if (!t.hasJSX(bodyStatementAst)) {
          continue;
        }
        if (t.isReturnStatement(bodyStatementAst)) {
          templateAst = bodyStatementAst.argument;

          return transformVueTemplate({
            node: templateAst,
            withJSXVariableDeclarations,
            withJSXFunctionDeclarations,
            scriptAsts,
            blockInfo: {},
          });
        } else if (t.isIfStatement(bodyStatementAst)) {
          let finalALternate = null;
          let currentAlternate = bodyStatementAst.alternate;
          let level = 1;
          while (currentAlternate && t.isIfStatement(currentAlternate)) {
            level += 1;
            currentAlternate = currentAlternate.alternate;
          }
          if (!currentAlternate) {
            for (let bodyStatementAstForIfStatement of body.body) {
              if (t.isReturnStatement(bodyStatementAstForIfStatement)) {
                finalALternate = bodyStatementAstForIfStatement.argument;
                break;
              }
            }
          }

          if (finalALternate) {
            const setPathLevels = new Array(level);
            set(bodyStatementAst, setPathLevels.fill('alternate').join('.'), finalALternate);
          }
          return transformVueTemplate({
            node: bodyStatementAst,
            withJSXVariableDeclarations,
            withJSXFunctionDeclarations,
            scriptAsts,
            blockInfo: {},
          });
        }
      }
      return '';
    } else if (t.isJSXElement(body)) {
      //箭头函数直接返回jsx
      return transformVueTemplate({
        node: body,
        withJSXVariableDeclarations,
        withJSXFunctionDeclarations,
        scriptAsts,
        blockInfo: {},
      });
    }
    return '';
  }
};
