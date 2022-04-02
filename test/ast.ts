import { getAst, getImportSourceList } from '../src/ast';
import { getFileContent } from '../src/file';

// node --inspect-brk ~/project_my/dependency-why/build/test/ast.js <filepath>
(async function () {
  const filePath = process.argv[2];
  const fileContent = await getFileContent(filePath);
  const ast = await getAst(fileContent, filePath);
  const importSourceList = await getImportSourceList(ast);
  console.log(filePath, importSourceList);
})();
