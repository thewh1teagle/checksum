# Building

Test locally using [Act](https://github.com/nektos/act)

## Update `v1` tag

`v1` should be always the latest version of `v1.x.x`

```console
git tag -d v1
git push --delete origin v1
git tag v1
git push --tags
```