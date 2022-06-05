import prettier from 'prettier';
import type { ResultType } from './types/index';
import generator from '@babel/generator';
import {genReact2VueBySourceCode} from './index';
import { genVueTemplate } from './utils/template';
import { genImportImportDeclaration,genReactProgramScript,tools } from './utils';
import * as fs from 'fs';


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
  result.functional?.forEach(functionNode=>{
    if(functionNode.isJsxFunction){
      console.log('%c [ isJsxFunction ]-37', 'font-size:13px; background:pink; color:#bf2c9f;', functionNode.isJsxFunction);
    }else{
      functionNode.scriptNode?.forEach((scriptNode)=>{
        const strScriptNodeCode = generator(scriptNode).code + '\n';
        script += strScriptNodeCode;
        // 替换xxRef.current => xxRef.value
        functionNode.reactivity?.ref?.forEach(name =>{
          const refReg = new RegExp(`${name}\.current`,'g');
          script = script.replace(refReg,  `${name}.value`);
        });

        //reactive
        functionNode.reactivity?.reactive?.forEach(([name,setterName]) =>{
          if(!setterName?.length) {return;}
          const refReg = new RegExp(`(${setterName})\(((.|\n)+?)\)`,'g');
          // 替换setxx 转换位赋值 state.xxx = xxx
          script = script.replace(refReg,  (match,p1,p2)=>{
            return `state.${setterName.slice(3,4).toLowerCase() + setterName.slice(4)}= ${p2}`;
          });
          // 目标中setxx 替换
          functionNode.template = functionNode.template.replace(refReg,  (match,p1,p2)=>{
            return `state.${setterName.slice(3,4).toLowerCase() + setterName.slice(4)}= ${p2}`;
          });
        });
      });
      template += functionNode.template;
    }
  });

  // vue 引入
  const vueImport = genImportImportDeclaration(result.vueImportSpecifiers, 'vue');
  result.import.unshift(generator(vueImport).code);

  // 自定义组件的引入
  Object.keys(result.customComponents).forEach(componentName=>{
    const comp = result.customComponents[componentName];
   
    // 生成组件文件
    const reactProgramScript = genReactProgramScript({
      functionScript:generator(comp.scriptNode[0]).code,
      exportName:componentName,
    });
   
    const dirPath = result.targetFile.split('/');
    const fileName = dirPath.pop();
    const compFileName = `${tools.toHorizontalLine(`${fileName.split('.')[0]}${componentName[0].toUpperCase()}${componentName.slice(1)}`)}`;
     //TODO TEST
    // fs.writeFileSync(`${dirPath.join('/')}/${compFileName}.tsx`, reactProgramScript);
    genReact2VueBySourceCode(reactProgramScript,`${dirPath.join('/')}/${compFileName}.vue`);
    const importScript = `import ${componentName} from './${compFileName}.vue;`;
    result.import.push(importScript);
  });

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
    htmlWhitespaceSensitivity:'css',
    endOfLine: "auto",
    rangeStart:0,
    rangeEnd:Infinity,

  });
};
