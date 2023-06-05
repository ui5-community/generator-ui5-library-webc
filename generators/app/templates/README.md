# UI5 Library `<%= name %>`

Web Components Enablement for `<%= webComponentsPackageName %>`

## One-time setup

 - `npm i`
 - `npm run ui5:prebuild` (to transpile the UI5 Web Components code to OpenUI5 code in `thirdparty/`)
 - `npm run generate` (to generate OpenUI5 wrapper controls for the web components in `<%= webComponentsPackageName %>`)

*Note: repeat these steps every time you upgrade to a new version of `<%= webComponentsPackageName %>`.* 

## Run the project

 - `npm run start`

The browser will automatically open the test page where you can find the OpenUI5 wrapper controls for your web components.
