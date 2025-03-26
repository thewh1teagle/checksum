# checksum

This action calculates the checksum (e.g., SHA-256) for all assets in your GitHub releases and generates a `checksum.txt` file. This is useful for ensuring file integrity during downloads and uploads.

## Usage

Include in your workflow file:

```yml
uses: thewh1teagle/checksum@v1
with:
  patterns: | # Optional
    *.zip
    *.tar.gz
  algorithm: sha256 # Optional. See bun.sh/docs/api/hashing#bun-cryptohasher for supported algorithms
```

You must enable write permission in github.com/user/repo/settings/actions -> Workflow permissions -> Read and write permissions.

## Inputs

| **Input Name** | **Description**                                                                                                                 | **Required** | **Default**      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------- |
| `repo`         | The GitHub repository in the format `owner/repo`.                                                                               | No           |                  |
| `patterns`     | File patterns to run checksum on. Supports glob patterns like `*.zip`, `*.tar.gz`.                                              | No           | `""` (all files) |
| `algorithm`    | Hash algorithm to use. Defaults to `sha256`. See [Bun hashing documentation](https://bun.sh/docs/api/hashing#bun-cryptohasher). | No           | `sha256`         |
| `pre-release`  | Whether to run on pre-releases.                                                                                                 | No           | `false`          |
| `tag`          | The tag of the release to generate checksums for.                                                                               | No           | `''`             |
| `file-name`    | The name of the checksum file to generate.                                                                                      | No           | `checksum.txt`   |
| `dry-run`      | Run without upload. will be available in the console output of the action.                                                      | No           | `checksum.txt`   |
| `bun-version`  | The version of Bun to use.                                                                                                      | No           | `latest`         |
| `reverse-order`| If set to true the order of checksum and filename in the output file will be reversed.                                          | No           | `false`          |

## Example checksum.txt

```txt
a.txt	ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb
b.txt	0263829989b6fd954f72baaf2fc64bc2e2f01d692d4de72986ea808f6e99813f
```

Each line separated by tab. (`\t`)

## Full example

<details>

```yml
name: Create checksum.txt

on:
  schedule:
    - cron: "0 1 * * *" # Runs at 1:00 AM UTC daily
  workflow_dispatch:

jobs:
  test:
    runs-on: macos-latest

    steps:
      - name: Run checksum action
        uses: thewh1teagle/checksum@v1
        with:
          patterns: | # Optional
            *.zip
            *.tar.gz
            *.txt
            !b.txt
          algorithm: sha256 # Optional
        env:
          # You must enable write permission in github.com/user/repo/settings/actions -> Workflow permissions -> Read and write permissions
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

</details>
