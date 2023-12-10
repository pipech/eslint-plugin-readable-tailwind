# Disallow unnecessary whitespace in tailwind classes (`readable-tailwind/no-unnecessary-whitespace`)

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->

## Options

<!-- begin auto-generated rule options list -->

| Name              | Description                                                                                                                                              | Type     | Default                           |
| :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :-------------------------------- |
| `allowMultiline`  | Allow multi-line class declarations. If this option is disabled, template literal strings will be collapsed into a single line string wherever possible. | Boolean  | `true`                            |
| `callees`         | List of function names whose arguments should also be considered.                                                                                        | String[] | [`clsx`, `cva`, `ctl`, `twMerge`] |
| `classAttributes` |                                                                                                                                                          | String[] |                                   |

<!-- end auto-generated rule options list -->