import path from "path";
import url from "url";
import fs from "fs";

import { extractPackageNameAndVersion } from "./utils.js";

// all below required dependencies need to be listed
// as dependencies in the package.json (not devDeps!)
import Generator from "yeoman-generator";
import yosay from "yosay";
import chalk from "chalk";
import { glob } from "glob";
import packageJson from "package-json";
import semver from "semver";
import validatePackageName from "validate-npm-package-name";
import isValidPath from "is-valid-path";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

export default class extends Generator {
	static displayName = "Create a new UI5 library with Web Components Enablement support";

	constructor(args, opts) {
		super(args, opts, {
			// disable the Yeoman 5 package-manager logic (auto install)!
			customInstallTask: "disabled"
		});
	}

	prompting() {
		// Have Yeoman greet the user.
		if (!this.options.embedded) {
			this.log(yosay(`Welcome to the ${chalk.red("generator-ui5-library")} generator!`));
		}

		const fwkInfo = {
			OpenUI5: {
				minVersion: "1.114.0", // <- minVersion for WebC enablement // "1.60.0",
				cdnDomain: "sdk.openui5.org",
				npmPackage: "@openui5/sap.ui.core"
			},
			SAPUI5: {
				minVersion: "1.114.0", // <- minVersion for WebC enablement // "1.77.0",
				cdnDomain: "ui5.sap.com",
				npmPackage: "@sapui5/distribution-metadata"
			}
		};

		const additionalProps = {};

		const prompts = [
			{
				type: "input",
				name: "namespace",
				message: "What is the namespace of your library?",
				validate: (s) => {
					const partInvalid = (part) => !/^[a-zA-Z0-9_]+$/.test(part);
					const parts = s.split(".");
					if (parts.length < 2) {
						return `A full library name is required (namespace included), please use at least one ${chalk.green(".")} character - f.e. ${chalk.green("demo.components")} or ${chalk.green(
							"my.demo.components"
						)} is ok, but just ${chalk.red("components")} is not`;
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
				choices: Object.keys(fwkInfo),
				default: Object.keys(fwkInfo)[0]
			},
			{
				when: (response) => {
					this._minFwkVersion = fwkInfo[response.framework].minVersion;
					return true;
				},
				type: "input", // HINT: we could also use the version info from OpenUI5/SAPUI5 to provide a selection!
				name: "frameworkVersion",
				message: "Which framework version do you want to use?",
				default: async (answers) => {
					const minVersion = fwkInfo[answers.framework].minVersion;
					const npmPackage = fwkInfo[answers.framework].npmPackage;
					try {
						return (
							await packageJson(npmPackage, {
								version: "*" // use highest version, not latest!
							})
						).version;
					} catch (ex) {
						chalk.red("Failed to lookup latest version for ${npmPackage}! Fallback to min version...");
						return minVersion[answers.framework];
					}
				},
				validate: (v) => {
					return (v && semver.valid(v) && semver.gte(v, this._minFwkVersion)) || chalk.red(`Framework requires the min version ${this._minFwkVersion}!`);
				}
			},
			{
				type: "input",
				name: "webComponentsPackage",
				message: `Choose a Web Components Package (and optionally version) to integrate.

Examples:
${chalk.green("some-package")}, ${chalk.green("@my/my-package")} (no version specified, "latest" will be used),
${chalk.green("some-package@2.0.1")}, ${chalk.green("@my/my-package@3.0.0")} (specific version specified)
${chalk.green("../my-package")} (path to a local package, must be relative to: ${chalk.blue(this.destinationRoot())})

`,
				validate: (s) => {
					// Local package
					if (s.startsWith(".")) {
						// First, make sure it's a relative path to a parent directory
						if (!s.startsWith(`..`)) {
							return `Invalid path - a relative path to a parent directory is required (must start with: ..)`;
						}

						// Make sure it doesn't contain invalid path characters
						if (!isValidPath(s)) {
							return "Invalid path";
						}

						// Try to read the package.json of the directory
						s = s.replace(/\\/g, "/");
						const packageFilePath = path.join(this.destinationRoot(), s, "package.json");
						let packageFile;
						try {
							packageFile = JSON.parse(fs.readFileSync(packageFilePath, { encoding: "utf8" }));
						} catch (e) {
							return `Cannot read package.json for ${s}, please set a path, relative to: ${this.destinationRoot()}`;
						}

						if (!packageFile.name) {
							return `The package file: ${packageFilePath} does not have a "name" property`;
						}
						additionalProps["webComponentsPackageName"] = packageFile.name;
						additionalProps["webComponentsPackageVersion"] = s;
						// Package from NPM
					} else {
						const { name, version } = extractPackageNameAndVersion(s);
						if (!validatePackageName(name)) {
							return "Invalid package name";
						}

						if (version !== "latest" && !semver.valid(version)) {
							return "Invalid package version";
						}
						additionalProps["webComponentsPackageName"] = name;
						additionalProps["webComponentsPackageVersion"] = version;
					}

					return true;
				},
				default: "../my-package"
			},
			{
				type: "input",
				name: "author",
				message: "Who is the author of the application?",
				default: this.user.git.name()
			},
			{
				type: "confirm",
				name: "newdir",
				message: "Would you like to create a new directory for the application?",
				default: true
			},
			{
				type: "confirm",
				name: "initrepo",
				message: "Would you like to initialize a local github repository for the application?",
				default: true
			}
		];

		return this.prompt(prompts).then((props) => {
			// use the namespace and the application name as new subdirectory
			if (props.newdir) {
				this.destinationRoot(this.destinationPath(`${props.namespace}`));
			}
			delete props.newdir;

			// apply the properties
			this.config.set(props);
			this.config.set(additionalProps);

			// libId + libURI + libBasePath
			this.config.set("libId", `${props.namespace}`);
			this.config.set("libURI", `${props.namespace.split(".").join("/")}`);
			this.config.set(
				"libBasePath",
				`${props.namespace
					.split(".")
					// eslint-disable-next-line no-unused-vars
					.map((_) => "..")
					.join("/")}`
			);

			// CDN domain
			this.config.set("cdnDomain", fwkInfo[props.framework].cdnDomain);
		});
	}

	writing() {
		// write library
		this.sourceRoot(path.join(__dirname, "templates"));
		glob
			.sync("**", {
				cwd: this.sourceRoot(),
				nodir: true
			})
			.forEach((file) => {
				const sOrigin = this.templatePath(file);
				const sTarget = this.destinationPath(file.replace(/^_/, "").replace("_library_", this.config.get("libURI")).replace(/\/_/, "/"));
				this.fs.copyTpl(sOrigin, sTarget, this.config.getAll());
			});
	}

	install() {
		this.config.set("setupCompleted", true);
		/*
		this.spawnCommandSync("npm", ["install"], {
			cwd: this.destinationPath()
		});
		*/
	}

	end() {
		if (this.config.get("initrepo")) {
			this.spawnCommandSync("git", ["init", "--quiet"], {
				cwd: this.destinationPath()
			});
			this.spawnCommandSync("git", ["add", "."], {
				cwd: this.destinationPath()
			});
			this.spawnCommandSync("git", ["commit", "--quiet", "--allow-empty", "-m", "Initial commit"], {
				cwd: this.destinationPath()
			});
		}
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
}
