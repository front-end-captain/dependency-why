import fs from 'fs-extra';
import path from 'path';
import debug from 'debug';
import semver from 'semver';
import { getAst, getImportSourceList } from './ast';
import { getFileContent, getWorkspacesFilePaths } from './file';
import { WorkspacePkg } from './pkgJson';

const SRC_DIR = 'apps/wind';

const log = debug('main');

// 将 <repo_root>/package.json `dependencies` 分散到各个项目的 package.json `dependencies` 字段中

// 1. 获取 <repo_root>/package.json
// 2. 获取 workspaces 下所有文件(.js/.ts/.jsx/.tsx)
// 3. 遍历所有文件，获得每个文件的 importSourceList
// 4. 遍历 <repo_root>/package.json `dependencies` 获得每个依赖项在都在哪些目录下的文件被引用过
// 5. 根据依赖项被引用的目录，将这个依赖项同步到该目录的package.json `dependencies` 字段中

interface AllFilesImportSourceListItem {
  path: string;
  importSourceList: string[];
}
async function getAllFilesImportSourceList(allFilePaths: string[]) {
  const result: Array<AllFilesImportSourceListItem> = [];

  for (const _path of allFilePaths) {
    log('[getAllFilesImportSourceList]', _path);

    const fileContent = await getFileContent(_path);
    const ast = await getAst(fileContent, _path);
    const importSourceList = await getImportSourceList(ast);
    result.push({ path: _path, importSourceList });
  }

  return result;
}

function referencedInWhichWorkspace(
  dependencyName: string,
  allFilesImportSourceList: AllFilesImportSourceListItem[],
): string[] {
  const referencedWorkspace = new Set<string>();

  allFilesImportSourceList.forEach((item) => {
    if (
      item.importSourceList.some((importSource) =>
        importSource.includes(dependencyName),
      )
    ) {
      const pathObj = path.parse(item.path);
      if (pathObj.dir) {
        const splittedDir = pathObj.dir.split('/');
        if (pathObj.dir.startsWith('src')) {
          referencedWorkspace.add(SRC_DIR);
        } else {
          referencedWorkspace.add(`${splittedDir[0]}/${splittedDir[1]}`);
        }
      }
    }
  });

  return Array.from(referencedWorkspace);
}

async function run(context: string) {
  const workspacePkg = new WorkspacePkg(context);
  await workspacePkg.init();

  const rootPkg = await workspacePkg.getSpecifiedDirPackageJson(context);

  if (!rootPkg.pkgJson) {
    return;
  }

  if (
    Array.isArray(rootPkg.pkgJson.workspaces) &&
    rootPkg.pkgJson.workspaces.length > 0
  ) {
    const workspaces = rootPkg.pkgJson.workspaces
      .map((workspace) => {
        return workspace.split('/')[0];
      })
      .concat('src', 'plugins', 'scripts');

    let allFilesImportSourceList = [];
    const allFilesImportSourceListFilePath = path.resolve(
      context,
      'allFilesImportSourceList.json',
    );
    if (fs.pathExistsSync(allFilesImportSourceListFilePath)) {
      allFilesImportSourceList = await fs.readJson(
        allFilesImportSourceListFilePath,
      );
    } else {
      allFilesImportSourceList = await getAllFilesImportSourceList(
        getWorkspacesFilePaths(workspaces),
      );
      fs.writeJSONSync(
        allFilesImportSourceListFilePath,
        allFilesImportSourceList,
      );
    }

    if (rootPkg.pkgJson.dependencies) {
      const dependenciesAnalysis: Array<{
        name: string;
        version: string;
        referencedWorkspace: {
          workspace: string;
          hasExplicitDeclaration: boolean;
          version: string;
          workspaceVersion: string;
          isVersionEqual: boolean;
        }[];
      }> = [];

      for (const [dependencyName, version] of Object.entries(
        rootPkg.pkgJson.dependencies,
      )) {
        const referencedWorkspace = referencedInWhichWorkspace(
          dependencyName,
          allFilesImportSourceList,
        );
        log(
          '[referencedInWhichWorkspace]',
          dependencyName,
          referencedWorkspace,
        );

        dependenciesAnalysis.push({
          name: dependencyName,
          version,
          referencedWorkspace: referencedWorkspace.map((workspace) => {
            if (workspace === SRC_DIR) {
              return {
                workspace,
                hasExplicitDeclaration: false,
                version,
                workspaceVersion: '',
                isVersionEqual: true,
              };
            }
            const pkg = workspacePkg.getSpecifiedDirPackageJson(workspace);
            if (pkg) {
              const hasExplicitDeclaration = Object.keys(
                pkg.pkgJson?.dependencies ?? {},
              ).includes(dependencyName);

              const _workspaceVersion =
                (pkg.pkgJson?.dependencies ?? {})[dependencyName] || '';

              let _isVersionEqual = false;
              try {
                _isVersionEqual = semver.eq(version, _workspaceVersion);
              } catch (_err) {
                log('[semver.eq]', version, _workspaceVersion);
              }
              return {
                workspace,
                hasExplicitDeclaration: hasExplicitDeclaration,
                version,
                workspaceVersion: _workspaceVersion,
                isVersionEqual: _isVersionEqual,
              };
            }
            return {
              workspace,
              hasExplicitDeclaration: false,
              version,
              workspaceVersion: '',
              isVersionEqual: true,
            };
          }),
        });
      }

      fs.writeJSONSync(
        path.resolve(context, 'dependenciesAnalysis.json'),
        dependenciesAnalysis,
      );
    }
  }
}

export { run };
