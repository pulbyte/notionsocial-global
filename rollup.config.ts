// import {nodeResolve} from "@rollup/plugin-node-resolve";
// import babel from "@rollup/plugin-babel";
// import pkg from "./package.json";

import dts from "rollup-plugin-dts";
import esbuild from "rollup-plugin-esbuild";

/**
 * @param {import('rollup').RollupOptions} config
 * @returns {import('rollup').RollupOptions}
 */
const bundle = (config) => ({
  ...config,
  input: "src/index.ts",
  external: (id) => !/^[./]/.test(id),
});

export default [
  bundle({
    plugins: [
      esbuild(),
      // nodeResolve(),
      // babel({
      //   babelHelpers: "bundled",
      // }),
    ],
    output: [
      {
        dir: "dist",
        format: "es",
        exports: "named",
        preserveModules: true, // Keep directory structure and files
      },
    ],
  }),
  bundle({
    plugins: [dts()],
    output: {
      dir: "dist",
      format: "es",
      exports: "named",
      preserveModules: true, // Keep directory structure and files
    },
  }),
];

// export default [
//   {
//     // UMD
//     input: "src",
//     plugins: [

//       terser(),
//     ],
//     output: {
//       file: `dist`,
//       format: "umd",
//       name: "notionsocial-global", // this is the name of the global object
//       esModule: false,
//       exports: "named",
//       sourcemap: true,
//     },
//   },
//   // ESM and CJS
//   {
//     input: "src",
//     plugins: [nodeResolve()],
//     output: [
//       {
//         dir: "dist/esm",
//         format: "esm",
//         exports: "named",
//         sourcemap: true,
//       },
//       {
//         dir: "dist/cjs",
//         format: "cjs",
//         exports: "named",
//         sourcemap: true,
//       },
//     ],
//   },
// ];
