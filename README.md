# 公共资源交易智能监管演示页面

仓库：https://github.com/wangzheng22/smart-supervision-pages

## 为什么「看不了」？

1. **`https://wangzheng22.github.io/...` 打开是 404**  
   说明还没在 GitHub 里**开启 Pages**（代码已在仓库里，但网站未发布）。

2. **在 GitHub 里点进 `cockpit.html` 只看到代码**  
   那是源码浏览，不是运行页面，需要下面「正式演示地址」。

3. **`raw.githubusercontent.com` 链接**  
   不能当正常网页用，样式和脚本往往失效。

4. **jsDelivr 链接在国内可能打不开**  
   以开启 GitHub Pages 后的 `github.io` 为准。

## 开启在线演示（只需做一次，约 1 分钟）

1. 打开：https://github.com/wangzheng22/smart-supervision-pages/settings/pages  
2. **Build and deployment → Source** 选 **Deploy from a branch**  
3. **Branch** 选 **`gh-pages`**，目录选 **`/ (root)`**，点 **Save**  
4. 等 1～3 分钟，直到 Settings → Pages 里出现绿色提示和站点地址  

若还没有 `gh-pages` 分支：打开 [Actions](https://github.com/wangzheng22/smart-supervision-pages/actions)，运行 **Publish GitHub Pages**（或任意 push 到 `main` 后会自动跑）。

也可以不用 `gh-pages`：Source 选 **Deploy from a branch → `main` → `/ (root)`** 保存即可。

## 正式演示地址（开启 Pages 后）

- 首页（跳转驾驶舱）：https://wangzheng22.github.io/smart-supervision-pages/  
- 驾驶舱（发改）：https://wangzheng22.github.io/smart-supervision-pages/cockpit.html?desk=fg  
- 线索回传：https://wangzheng22.github.io/smart-supervision-pages/clue-return.html  
- 线索列表：https://wangzheng22.github.io/smart-supervision-pages/clues.html  

## 本地运行

```bash
cd 智能监管页面
python3 -m http.server 8777
```

浏览器打开：http://127.0.0.1:8777/clue-return.html
