import { parseCodeAst,  } from './parser';
import { generateR2SCode } from './transform';
import * as fs from 'fs';

export * from './parser';
export * from './transform';

export const genReact2VueBySourceCode = async (sourceCode:string, targetFile:string) => {
    try {
      let reactAst = parseCodeAst(sourceCode);
      const targetContent = generateR2SCode({
        sourceAst: reactAst,
        sourceCode: sourceCode,
      },targetFile);
       fs.writeFileSync(targetFile, targetContent);
    } catch (err) {
      console.error(err);
    }
  };

export const genReact2VueCode = async (sourceFile:string, targetFile:string) => {
    try {
        let sourceCode = await fs.readFileSync(sourceFile, 'utf8');
        let reactAst = parseCodeAst(sourceCode);
        const targetContent = generateR2SCode({
            sourceAst: reactAst,
            sourceCode: sourceCode,
        },targetFile);
        fs.writeFileSync(targetFile, targetContent);
    } catch (err) {
        console.error(err);
    }
};