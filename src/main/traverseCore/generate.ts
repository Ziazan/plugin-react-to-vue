import prettier from 'prettier';
import type { ResultType } from './types/index';
import generator from '@babel/generator';

import { genVueTemplate } from './utils/template';
import { genImportImportDeclaration,genImportSpecifier } from './utils';


export const generateVueComponent = (result: ResultType): string => {
  let script = '';
  let template = '';

  // class
  if(Object.keys(result.class)?.length){
    // constructor
    script += result.class.constructor;
    // life cycle
    if(result.class?.lifeCycles){
      script += Object.keys(result.class?.lifeCycles)?.reduce((str, methodKey) => {
        str += result.class.lifeCycles[methodKey];
        return str;
      }, '');
    }
    result.class?.scriptNode.forEach((scriptNode)=>{
      script += generator(scriptNode).code + '\n';
    });
    template += result.class.render;
  }
  
  

  // functional
  // script 
  console.log('%c  result.functional:', 'color: #0e93e0;background: #aaefe5;', result.functional?.length);
  result.functional?.forEach(functionNode=>{
    if(functionNode.isJsxFunction){
      //TODO 创建新文件
    }else{
      functionNode.scriptNode?.forEach((scriptNode)=>{
        script += generator(scriptNode).code + '\n';
        // 替换xxRef.current => xxRef.value
        functionNode.reactivity?.ref?.forEach(name =>{
          const refReg = new RegExp(`${name}\.current`,'g');
          script = script.replace(refReg,  `${name}.value`);
        });
      });
      template += functionNode.template;
    }
  });

  // 替换setxx 转换位赋值 state.xxx = xxx
  script = script.replace(/set(.*?)\((.*?)\)/g,  (match,p1,p2)=>{
    return `state.${p1.toString().toLowerCase()}= ${p2}`;
  });

  // vue 引入
  const vueImport = genImportImportDeclaration(result.vueImportSpecifiers, 'vue');
  result.import.unshift(generator(vueImport).code);

  const vueCode = genVueTemplate({
    template: template,
    importScript: result.import.join('\n'),
    script: script,
  });
  // 代码格式化
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
};
