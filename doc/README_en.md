**[简体中文](../README.md) | English**

**Preface:**  
VJudge provides many powerful features, such as teams, problem sets, solve details, AC code export, and more.  
So I wanted to build a tool that can synchronize accepted problem data from other OJs to VJudge, making it easier to manage everything in one place.

# VJudge の AC Automaton

This tool is designed for **one-click synchronization of accepted records from other OJs that have already been linked on VJudge**.  
It currently supports most mainstream OJs.

Continuously updating...

## Current Features

- [x] Luogu
- [x] Codeforces
- [x] AtCoder
- [x] QOJ
- [x] UOJ
- [x] NowCoder (paid problems are not supported yet)
- [x] Auto-fill cookies
- [x] Browser extension version
- [x] Customizable sync rate

- [ ] vj-better
- [ ] One-click career data chart export
- [ ] Simplified problem set / contest creation
- [ ] Problem tag organization

## Quick Start

### One-click Accepted Record Sync
**If you have already linked your accounts on VJudge, you can sync with one click.**

1. After installing the script or extension, open VJudge and a side panel / popup will appear.
2. Select the OJs you want to sync, then click **"One-click Sync"**.
3. To stop syncing, simply refresh the page or close the window. (I was too lazy to implement a stop button.)
- Note: The first sync may take a while if you have many solved problems, so please be patient.

  VJudge has been updated recently, so some bugs in this tool may still be undiscovered. Issues are welcome.

**Tampermonkey script version:**  
(Currently unavailable after changes to VJudge's API structure. The browser extension version is recommended.)

![](doc/panel.png)

**Browser extension version:**  
(Supports Chromium-based browsers)
- Note: Click the pin icon in the upper-right corner of the popup to enter **window mode**. In this mode, synchronization will not be interrupted when switching tabs.

![](doc/popup.png)

### One-click Cookie Auto-fill
**You can also fill cookies on VJudge with one click.**

1. Open any problem and go to the **Submit Code** page.
2. Click **Account Management**, then after the page redirects, choose **Browser Session**, and click the **Fill Cookie** button in the popup to auto-fill cookies. (Window mode is not supported for this feature.)
3. If used incorrectly, nothing will happen.

![](doc/auto-fill.png)

## Download

**[Project Repository](https://github.com/Tabris-ZX/vjudge-sync)**

### Tampermonkey Script Download
**[Click here to install from Greasy Fork](https://greasyfork.org/zh-CN/scripts/559149-vjudge%E3%81%AEac%E8%87%AA%E5%8A%A8%E6%9C%BA)**

### Browser Extension Download
Download and extract this project, then load the **Extension** folder on your browser's extension page.

**No packaged release is available yet.**

## Acknowledgements

- Thanks to the VJudge platform for its great ecosystem.

- AtCoder data is supported by the following project. Many thanks to its author: [AtCoder Problems](https://github.com/kenkoooo/AtCoderProblems)

- Thanks to qcjj from NowCoder for the help and for proposing VJudge support for NowCoder archiving.

- The cookie filling feature is inspired by the official browser extension provided by VJudge.

<div align="center">

### 🌟 If this project helps you, please give it a Star!
**If you run into any problems, feel free to open an issue!**

</div>

