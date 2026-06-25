// js/abi.js — ABI (минимальный ERC-20 для вывода)
const ERC20_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];
window.ERC20_ABI = ERC20_ABI;
console.log('%cABI loaded', 'color:#00ff9d');
