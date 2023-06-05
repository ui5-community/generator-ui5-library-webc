"use strict";
const fs = require("fs");
const process = require("process");
const path = require("path");
const Generator = require("yeoman-generator");
const chalk = require("chalk");
const glob = require("glob");
const semver = require("semver");
const validatePackageName = require("validate-npm-package-name");
const isValidPath = require("is-valid-path");
const { extractPackageNameAndVersion } = require("./utils");

module.exports = class extends Generator {
  static displayName = "Create a new OpenUI5/SAPUI5 library with Web Components Enablement support";

  async prompting() {

    const prompts = [
      {
        type: "input",
        name: "name",
        message: `Choose the ${chalk.italic("technical")} name for this library`,
        validate: s => {
          const partInvalid = part => !/^[a-zA-Z0-9_]+$/.test(part);
          const parts = s.split(".");
          if (parts.length < 2) {
            return `A full library name is required (namespace included), please use at least one ${chalk.green(".")} character - f.e. ${chalk.green("demo.components")} or ${chalk.green("my.demo.components")} is ok, but just ${chalk.red("components")} is not`;
          }

          if (parts.some(partInvalid)) {
            return "Please use alpha-numeric characters only for both the namespace parts and the library name.";
          }

          return true;
        },
        default: "demo.components"
      },
      {
        type: "list",
        name: "framework",
        message: "Which framework do you want to use?",
        choices: ["OpenUI5", "SAPUI5"],
        default: "OpenUI5"
      },
      {
        when: response => {
          const minFwkVersion = {
            OpenUI5: "1.114.0",
            SAPUI5: "1.77.0"
          };
          this._minFwkVersion = minFwkVersion[response.framework];
          return true;
        },
        type: "input", // HINT: we could also use the version info from OpenUI5/SAPUI5 to provide a selection!
        name: "frameworkVersion",
        message: "Which framework version do you want to use?",
        default: "1.114.0",
        validate: v => {
          return (
            (v && semver.valid(v) && semver.gte(v, this._minFwkVersion)) ||
            chalk.red(
              `Framework requires the min version ${this._minFwkVersion}!`
            )
          );
        }
      },
      {
        type: "confirm",
        name: "newdir",
        message: "Would you like to create a new directory for the library?",
        default: true
      }
    ];

    const props = await this.prompt(prompts);

    // This is needed before the last prompt - if a local directory is used, it must be valid relatively to the destination root
    if (props.newdir) {
      this.destinationRoot(this.destinationPath(`${props.name}`));
    }
    const destinationRoot = this.destinationRoot(); // will be needed in the web components package prompt
    let localPackageName; // will be set during the web components package prompt if a local package is chosen by the user

    const webComponentsPackagePrompt = {
      type: "input",
      name: "webComponentsPackage",
      message: `Choose a Web Components Package (and optionally version) to integrate.

Examples:
${chalk.green("some-package")}, ${chalk.green("@my/my-package")} (no version specified, "latest" will be used),
${chalk.green("some-package@2.0.1")}, ${chalk.green("@my/my-package@3.0.0")} (specific version specified)
${chalk.green("../my-package")} (path to a local package, must be relative to: ${chalk.blue(destinationRoot)})

`,
      validate: s => {
        // Local package
        if (s.startsWith(".")) {
          // First, make sure it's a relative path to a parent directory
          if (!s.startsWith(`..${path.sep}`)) {
            return `Invalid path - must start with: ..${path.sep}`;
          }

          // Make sure it doesn't contain invalid path characters
          if (!isValidPath(s)) {
            return "Invalid path";
          }

          // Try to read the package.json of the directory
          const packageFilePath = path.join(destinationRoot, s, "package.json");
          let packageFile;
          try {
            packageFile = JSON.parse(fs.readFileSync(packageFilePath));
          } catch (e) {
            return `Cannot read package.json for ${s}, please set a path, relative to: ${destinationRoot}`;
          }

          localPackageName = packageFile.name;
          if (!localPackageName) {
            return `The package file: ${packageFilePath} does not have a "name" property`;
          }
        // Package from NPM
        } else {
          const { name, version } = extractPackageNameAndVersion(s);
          if (!validatePackageName(name)) {
            return "Invalid package name";
          }

          if (version !== "latest" && !semver.valid(version)) {
            return "Invalid package version";
          }
        }

        return true;
      },
      default: "../my-package"
    };

    const { webComponentsPackage } = await this.prompt([webComponentsPackagePrompt]);

    if (localPackageName) {
      // Local package
      this.config.set("webComponentsPackageName", localPackageName);
      this.config.set("webComponentsPackageVersion", webComponentsPackage);
    } else {
      // Package from NPM
      const { name, version } = extractPackageNameAndVersion(webComponentsPackage);
      this.config.set("webComponentsPackageName", name);
      this.config.set("webComponentsPackageVersion", version);
    }

    this.config.set(props);
    this.config.set("author", this.user.git.name());
    this.config.set("libraryURI", props.name.split(".").join("/"));
    this.config.set("frameworklowercase", props.framework.toLowerCase());
  }

  writing() {
    const oConfig = this.config.getAll();

    this.sourceRoot(path.join(__dirname, "templates"));
    glob
      .sync("**", {
        cwd: this.sourceRoot(),
        nodir: true
      })
      .forEach(file => {
        const sOrigin = this.templatePath(file);
        let sTarget = this.destinationPath(
          file
            .replace(/^_/, "")
            .replace("baselibrary", oConfig.libraryURI)
            .replace(/\/_/, "/")
        );

        this.fs.copyTpl(sOrigin, sTarget, oConfig);
      });
  }

  install() {
    this.config.set("setupCompleted", true);
  }

  end() {
    this.spawnCommandSync("git", ["init", "--quiet"], {
      cwd: this.destinationPath()
    });
    this.spawnCommandSync("git", ["add", "."], {
      cwd: this.destinationPath()
    });
    this.spawnCommandSync(
      "git",
      [
        "commit",
        "--quiet",
        "--allow-empty",
        "-m",
        "Initialize repository with UI5 Library Generator"
      ],
      {
        cwd: this.destinationPath()
      }
    );

    this.log(`
Setup Complete!
Run:

${chalk.green(`cd ${this.destinationPath()}
npm i
npm run ui5:prebuild
npm run generate
npm run start`)}

You can also find these instructions in the ${chalk.blue("README.md")} file.
`);

  }
};
