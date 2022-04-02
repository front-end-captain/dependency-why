import path from 'path';
import fs from 'fs-extra';
import { $ } from 'zx';

import { BasePkgFields } from './types';

class WorkspacePkg {
  private workspacePkgs: Record<string, { pkgJson: BasePkgFields | null }>;
  private context: string;

  constructor(context: string) {
    this.context = context;
    this.workspacePkgs = {};
  }

  static async getPackageJson(dir: string) {
    const pkgJsonPath = path.resolve(dir, 'package.json');
    let pkgJson: BasePkgFields | null = null;

    if (!fs.pathExistsSync(pkgJsonPath)) {
      return null;
    }

    try {
      pkgJson = await fs.readJSON(pkgJsonPath);
    } catch (err) {
      console.log('[error][getPackageJson]', pkgJsonPath);
    }

    return pkgJson;
  }

  public updatePackageJsonDependencies(
    dir: string,
    dependencyName: string,
    version: string,
  ) {
    const packageJson = this.workspacePkgs[dir].pkgJson;

    if (packageJson) {
      if (
        dir.startsWith('packages') &&
        (dependencyName === 'react' || dependencyName === 'react-dom')
      ) {
        packageJson.peerDependencies = {
          ...(packageJson.peerDependencies || {}),
          ...{ [dependencyName]: version },
        };
        return;
      }
      packageJson.dependencies = {
        ...(packageJson.dependencies || {}),
        ...{ [dependencyName]: version },
      };
    }
  }

  public removeRootPackageJsonDependencies(dependencyName: string) {
    const rootPkg = this.workspacePkgs[this.context];
    if (rootPkg.pkgJson) {
      if (rootPkg.pkgJson.dependencies) {
        delete rootPkg.pkgJson.dependencies[dependencyName];
      }
    }
  }

  public dispersePackageJson() {
    for (const [dir, { pkgJson }] of Object.entries(this.workspacePkgs)) {
      const _path = `${path.resolve(this.context, dir)}/package.json`;
      fs.writeJSONSync(_path, pkgJson);
      $`${this.context}/node_modules/.bin/prettier -w ${_path}`;
    }
  }

  public async init() {
    const rootPkgJson = await WorkspacePkg.getPackageJson(this.context);
    if (rootPkgJson) {
      this.workspacePkgs[this.context] = { pkgJson: rootPkgJson };

      const workspacesDirs = (rootPkgJson.workspaces || [])
        .map((dir) => dir.replace(/\*$/, ''))
        .map((dir) => fs.readdirSync(dir).map((walk) => path.join(dir, walk)))
        .flat();
      for (const dir of workspacesDirs) {
        const pkgJson = await WorkspacePkg.getPackageJson(
          `${this.context}/${dir}`,
        );
        this.workspacePkgs[dir] = { pkgJson };
      }
    }
  }

  public getSpecifiedDirPackageJson(dir: string) {
    return this.workspacePkgs[dir];
  }
}

export { WorkspacePkg };
