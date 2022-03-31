import { traverse, parseAsync } from '@babel/core';
import * as t from '@babel/types';

export async function getAst(
  fileContent: string,
  fileName: string,
): Promise<t.File | t.Program | null> {
  let ast: t.File | t.Program | null = null;

  try {
    ast = await parseAsync(fileContent, {
      ast: true,
      sourceType: 'module',
      presets: [
        '@babel/preset-env',
        '@babel/preset-react',
        '@babel/preset-typescript',
      ],
      plugins: [
        [
          '@babel/plugin-proposal-decorators',
          { decoratorsBeforeExport: true },
        ],
      ],
      filename: fileName,
    });
  } catch (err) {
    console.log('[get ast error]', err);
  }

  return ast;
}

export function getImportSourceList(ast: t.File | t.Program | null) {
  const importSourceList: string[] = [];
  if (ast) {
    traverse(ast, {
      ImportDeclaration(path) {
        importSourceList.push(path.node.source.value);
      },
      CallExpression(path) {
        if (path.node.callee.type === 'Import') {
          path.node.arguments.forEach((arg) => {
            if (arg.type === 'StringLiteral') {
              importSourceList.push(arg.value);
            }
          });
        }
      },
    });
  }

  return importSourceList;
}

