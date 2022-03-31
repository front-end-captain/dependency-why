import fs from 'fs-extra';
import * as globby from 'globby';

export async function getFileContent(sourceFilePath: string) {
  let fileContent = '';
  try {
    fileContent = await fs.readFile(sourceFilePath, { encoding: 'utf-8' });
  } catch (err) {
    console.log('[error][getFileContent]', sourceFilePath);
  }
  return fileContent;
}

export function getWorkspacesFilePaths(workspaces: string[]) {
  let paths: string[] = [];

  workspaces.forEach((workspace) => {
    const pattern = `${workspace}/**/*.(ts|js|tsx|jsx)`;
    const _paths = globby.sync(pattern, {
      ignore: [
        '*.map',
        '*.test.*',
        '**/node_modules/**',
        '*.d.ts',
        '**/dist/**',
        '**/es/**',
        '**/tests/**',
      ],
    });
    paths = paths.concat(_paths);
  });

  return paths;
}