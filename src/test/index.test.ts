import { parseCodeAst, generateR2SCode } from '../main/traverseCore/index';
import * as fs from 'fs';

// const FILE_NAME = 'defaultDeclaraArrow','defaultArrow','CopySuccess','defaultFunction','defaultDeclaraFunction','defaultClass','defaultDeclaraClass'
// const FILE_NAME = 'defaultArrow';
const FILE_LIST = [
  // 'CopySuccess',
//   'defaultDeclaraArrow',
//   'defaultArrow',
  // 'defaultFunction',
//   'defaultDeclaraFunction',
  'defaultClass',
  // 'classLifeCircle',
  // 'defaultDeclaraClass',
  // 'defaultJsx',
  // 'customTag',
  // 'demo',
  // 'demo3',
  // 'reactHook',
  // 'channel-manager-card',
  // 'multipleReturn',
  // 'test',
  // 'useRef',
  // 'setState',
  // 'renderJsx'
];

const genReact2VueCode = async (sourceFile, targetFile) => {
  try {
    let sourceCode = await fs.readFileSync(sourceFile, 'utf8');
    let reactAst = parseCodeAst(sourceCode);
    const targetContent = generateR2SCode({
      sourceAst: reactAst,
      sourceCode: sourceCode,
    });
    const data = await fs.writeFileSync(targetFile, targetContent);
    //文件写入成功。
  } catch (err) {
    console.error(err);
  }
};

FILE_LIST.forEach(async (name) => {
  const sourceFile = `./src/test/demo/${name}.tsx`;
  const targetFile = `./src/test/demo/${name}_3.vue`;
  console.log(`========== 转换 ${sourceFile} START ==========`);
  await genReact2VueCode(sourceFile, targetFile);
  console.log(`========== 导出文件 ${name} END ==========`);
});
