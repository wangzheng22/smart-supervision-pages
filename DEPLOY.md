# 线上可直接打开的地址

## 为什么 GitHub 链接是 404？

`https://wangzheng22.github.io/smart-supervision-pages/` **只有在仓库里开启 GitHub Pages 后才会生效**。  
代码和 `gh-pages` 分支都已准备好，但 **Pages 开关默认是关的**，需要仓库管理员点一次（约 30 秒）。

### 开启 GitHub Pages（推荐，长期免费）

1. 登录 GitHub 账号 **wangzheng22**
2. 打开：https://github.com/wangzheng22/smart-supervision-pages/settings/pages
3. **Source** → **Deploy from a branch**
4. **Branch** → `gh-pages`，目录 **`/ (root)`** → **Save**
5. 等 2～5 分钟后访问：
   - https://wangzheng22.github.io/smart-supervision-pages/clue-return.html
   - https://wangzheng22.github.io/smart-supervision-pages/cockpit.html?desk=fg

## 备选：Vercel（开启 Pages 前也能用）

在本机项目目录执行（首次会打开浏览器登录 Vercel，免费）：

```bash
cd "/Users/glodon/Documents/01广联达/01产品/19智能监管/智能监管页面"
chmod +x scripts/deploy-vercel.sh
./scripts/deploy-vercel.sh
```

终端里会出现 **`https://xxxx.vercel.app`**，把该地址发给他人即可。

## 本地临时公网（演示用，关电脑即失效）

```bash
python3 -m http.server 8777
# 另开终端
npx localtunnel --port 8777
```

按终端提示的 `https://xxx.loca.lt` 访问（首次可能需点「Continue」）。
