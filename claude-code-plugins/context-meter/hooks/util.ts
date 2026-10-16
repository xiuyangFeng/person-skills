// 终端与桌面两套绘制共用的小工具

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|[\u2699]|\p{Emoji_Presentation}/u

/** 终端里占几格：全角、emoji 记 2。桌面端拿它粗估文字宽度（比例字体只会更窄）。 */
export const cellWidth = (s: string): number => {
  let w = 0
  for (const ch of s) w += WIDE.test(ch) ? 2 : 1
  return w
}
