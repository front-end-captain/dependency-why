import path from 'path';
import fs from 'fs-extra';

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

  public async init() {
    const rootPkgJson = await WorkspacePkg.getPackageJson(this.context);
    if (rootPkgJson) {
      this.workspacePkgs[this.context] = { pkgJson: rootPkgJson };

      const workspacesDirs = (rootPkgJson.workspaces || [])
        .map((dir) => dir.replace(/\*$/, ''))
        .map((dir) => fs.readdirSync(dir).map((walk) => path.join(dir, walk)))
        .flat()
        .concat('');

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
