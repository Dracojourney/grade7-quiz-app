/* ============================================================================
 * seed-questions.js —— 题库核心（科目表 / 来源类型 / 历史目录树 / 已核对样板题）
 *
 * 为什么用 JS 挂 window 而不是 fetch JSON：
 *   file:// 协议下浏览器会拦截 fetch 读本地文件，故题库内嵌为 window.XBJ_SEED。
 *
 * 加载顺序（index.html）：本文件 → seed-geo.js → seed-bio.js → seed-hist.js → storage.js → app.js
 *   seed-geo.js / seed-bio.js / seed-hist.js 由 tools/build-seed.js 从 data/extracted/ 生成，
 *   负责向 window.XBJ_SEED 追加本科章树与题目，不要手改生成物。
 *
 * 入池规则（2026-10-31 用户授权变更，详见 js/app.js getPool 注释）：
 *   1. 接受 reviewStatus = book_checked（已核对）与 book_transcribed（AI 依书页生成、待抽检）。
 *   2. needsFigure = true（缺配图）、example = true、pending_book_check 一律不进池。
 *   3. contentOrigin = 'book' 的书内题；web 来源（keypoint）随数据加载但绝不出给学生。
 *   4. getPool() 是唯一入池入口，任何界面都不得绕过。
 * ==========================================================================*/
window.XBJ_SEED = {
  meta: {
    bundleVersion: '1.2.0',
    schemaVersion: '1.1',
    generatedAt: '2026-10-31T00:00:00+08:00',
    poolMode: 'transcribed_allowed',
    note: '书目录（学霸笔记）为导航主键；教材章节降为映射字段。' +
      '2026-10-31 起入池开放到 book_transcribed（未抽检先用），needsFigure 仍排除。'
  },

  SUBJECTS: [
    { id: 'geo',  name: '地理', bookTitle: '初中学霸创新题·地理（湘教版）七上',  chapterUnit: '章' },
    { id: 'hist', name: '历史', bookTitle: '初中学霸创新题·历史（统编版）七上',  chapterUnit: '单元' },
    { id: 'bio',  name: '生物', bookTitle: '初中学霸创新题·生物（人教版）七上',  chapterUnit: '章' }
  ],

  /* 书目录树（学霸笔记内页目录，2026-10-30 照片转录，docs/01 第三节）。
   * page = 该节在书内的起始页码（书内页码，非教材页码）。
   * 三科章树均由 seed-<科目>.js 从 data/extracted/ 生成并覆盖
   * （2026-10-31 历史题库产出后，本文件不再保留手写章树）。 */
  TREES: {
    geo: [],
    hist: [],
    bio: []
  },

  /* 来源类型（书内内容形态，docs/04 3.1a） */
  SOURCE_TYPES: {
    highlight: '划重点', table: '表格', mindmap: '思维导图', keypoint: '考点要点', figure: '图表判读'
  },

  /* 已核对样板题（地理·书第三章·世界的地形）。
   * book_checked 5 道（书内来源，页码已按 2026-10-30 照片回填）；
   * pending_book_check 5 道（web 来源，keypoint，不出给学生）。
   * 地理其余章节、生物全科、历史全科由 seed-geo.js / seed-bio.js / seed-hist.js
   * 追加（book_transcribed）；历史 12 道 inferred 题（pending_book_check）已排除。 */
  QUESTIONS: [
    {
      id: 'GEO-C03-S02-K03-Q01', subject: 'geo',
      bookChapterId: 'GEO-C03', bookChapterTitle: '第三章 地球的面貌',
      bookSectionId: 'GEO-C03-S02', bookSectionTitle: '世界的地形',
      textbook: { version: 'XJ2024', chapter: '第三章 地球的面貌', section: '第二节 世界的地形' },
      contentOrigin: 'book', sourceType: 'table', sourcePage: 'P18',
      kpId: 'GEO-C03-S02-K03', kpTags: ['五种基本地形', '地形特征'],
      type: 'single_choice', difficulty: 1,
      stem: { text: '下列关于五种基本地形特征的描述，正确的是哪一项？' },
      options: [
        { key: 'A', text: '平原海拔较低，一般在 200 米以下，地面平坦' },
        { key: 'B', text: '高原海拔一般在 200 米以下，地势起伏大' },
        { key: 'C', text: '山地海拔多在 500 米以下，坡度平缓' },
        { key: 'D', text: '丘陵相对高度一般超过 500 米，沟谷较深' }
      ],
      answer: { value: 'A' },
      explanation: {
        summary: '平原：海拔一般 200 米以下，地面平坦。',
        detail: '依据五种基本地形的划分标准：平原海拔一般在 200 米以下且地面平坦；高原海拔一般在 500 米以上、边缘比较陡峭；山地海拔多在 500 米以上、坡度较陡；丘陵海拔多在 500 米以下、相对高度一般不超过 200 米。B、C、D 三项的海拔或相对高度数据均与标准不符。',
        commonMistake: '把高原与平原的海拔标准记反，或把丘陵与山地的相对高度混淆。',
        bookRef: '本书 P18 五种基本地形表；课本 P47'
      },
      reviewStatus: 'book_checked', reviewState: 'book_checked', example: false
    },
    {
      id: 'GEO-C03-S02-K06-Q02', subject: 'geo',
      bookChapterId: 'GEO-C03', bookChapterTitle: '第三章 地球的面貌',
      bookSectionId: 'GEO-C03-S02', bookSectionTitle: '世界的地形',
      textbook: { version: 'XJ2024', chapter: '第三章 地球的面貌', section: '第二节 世界的地形' },
      contentOrigin: 'book', sourceType: 'table', sourcePage: 'P19',
      kpId: 'GEO-C03-S02-K06', kpTags: ['陆地地形世界之最'],
      type: 'single_choice', difficulty: 1,
      stem: { text: '世界上面积最大的平原是哪一个？' },
      options: [
        { key: 'A', text: '亚马孙平原' }, { key: 'B', text: '刚果盆地' },
        { key: 'C', text: '巴西高原' }, { key: 'D', text: '青藏高原' }
      ],
      answer: { value: 'A' },
      explanation: {
        summary: '世界最大的平原是南美洲的亚马孙平原。',
        detail: '因为亚马孙平原位于南美洲，是世界上面积最大的平原；刚果盆地是世界最大的盆地，巴西高原是世界最大的高原，青藏高原是世界最高的高原。三个干扰项虽然都是真实的“世界之最”，但地形类型或称号与本题所问不符。',
        commonMistake: '把“最大平原”与“最大盆地”（刚果盆地）混淆。',
        bookRef: '本书 P19 世界陆地地形之最表；课本 P46 图3-20'
      },
      reviewStatus: 'book_checked', reviewState: 'book_checked', example: false
    },
    {
      id: 'GEO-C03-S02-K08-Q05', subject: 'geo',
      bookChapterId: 'GEO-C03', bookChapterTitle: '第三章 地球的面貌',
      bookSectionId: 'GEO-C03-S02', bookSectionTitle: '世界的地形',
      textbook: { version: 'XJ2024', chapter: '第三章 地球的面貌', section: '第二节 世界的地形' },
      contentOrigin: 'book', sourceType: 'table', sourcePage: 'P19',
      kpId: 'GEO-C03-S02-K08', kpTags: ['海底地形', '大陆架'],
      type: 'fill_blank', difficulty: 1,
      stem: { text: '在海底地形中，陆地向海洋的自然延伸部分、坡度较缓、水深一般在 200 米以内的部位叫________。' },
      answer: { accept: ['大陆架'], normalize: true },
      explanation: {
        summary: '该部位是大陆架，蕴藏石油、天然气等资源。',
        detail: '依据海底地形的划分：大陆架是陆地向海洋的自然延伸部分，坡度较缓、水深一般在 200 米以内，蕴藏丰富的矿产资源；大陆坡是大陆架外缘水深急剧增大的陡坡，海沟是海洋底部最深的地方，洋盆是大洋底部的主体，均与本题描述不符。',
        commonMistake: '把大陆架与大陆坡混淆，记住“200 米以内”这个关键数字。',
        bookRef: '本书 P19 海底地形表'
      },
      reviewStatus: 'book_checked', reviewState: 'book_checked', example: false
    },
    {
      id: 'GEO-C03-S02-K07-Q08', subject: 'geo',
      bookChapterId: 'GEO-C03', bookChapterTitle: '第三章 地球的面貌',
      bookSectionId: 'GEO-C03-S02', bookSectionTitle: '世界的地形',
      textbook: { version: 'XJ2024', chapter: '第三章 地球的面貌', section: '第二节 世界的地形' },
      contentOrigin: 'book', sourceType: 'highlight', sourcePage: 'P18',
      kpId: 'GEO-C03-S02-K07', kpTags: ['两大山脉带', '科迪勒拉山系'],
      type: 'single_choice', difficulty: 2,
      stem: { text: '科迪勒拉山系主要由哪两条山脉组成？' },
      options: [
        { key: 'A', text: '落基山脉和安第斯山脉' },
        { key: 'B', text: '喜马拉雅山脉和阿尔卑斯山脉' },
        { key: 'C', text: '阿尔卑斯山脉和阿特拉斯山脉' },
        { key: 'D', text: '安第斯山脉和喜马拉雅山脉' }
      ],
      answer: { value: 'A' },
      explanation: {
        summary: '科迪勒拉山系 = 落基山脉 + 安第斯山脉。',
        detail: '因为科迪勒拉山系属于太平洋沿岸山脉带，主要由北美洲的落基山脉和南美洲的安第斯山脉组成；喜马拉雅山脉、阿尔卑斯山脉、阿特拉斯山脉等属于另一条山脉带——横贯亚欧大陆南部和非洲西北部的山脉带。',
        commonMistake: '把两条山脉带的山脉混选，尤其容易把喜马拉雅山脉误归入科迪勒拉山系。',
        bookRef: '本书 P18 划重点“两大山脉带”'
      },
      reviewStatus: 'book_checked', reviewState: 'book_checked', example: false
    },
    {
      id: 'GEO-C03-S02-K06-Q10', subject: 'geo',
      bookChapterId: 'GEO-C03', bookChapterTitle: '第三章 地球的面貌',
      bookSectionId: 'GEO-C03-S02', bookSectionTitle: '世界的地形',
      textbook: { version: 'XJ2024', chapter: '第三章 地球的面貌', section: '第二节 世界的地形' },
      contentOrigin: 'book', sourceType: 'table', sourcePage: 'P19',
      kpId: 'GEO-C03-S02-K06', kpIdsSecondary: ['GEO-C03-S02-K03'], kpTags: ['陆地地形世界之最', '综合辨析'],
      type: 'single_choice', difficulty: 3,
      stem: { text: '下列地形类型与“世界之最”的对应，正确的是哪一项？' },
      options: [
        { key: 'A', text: '最大高原——青藏高原' },
        { key: 'B', text: '最长山脉——安第斯山脉' },
        { key: 'C', text: '最大盆地——巴西盆地' },
        { key: 'D', text: '最高山脉——阿尔卑斯山脉' }
      ],
      answer: { value: 'B' },
      explanation: {
        summary: '世界最长的山脉是安第斯山脉。',
        detail: '因为世界最长的山脉是南美洲的安第斯山脉，B 项对应正确；青藏高原是世界“最高”的高原而非“最大”（最大的高原是巴西高原）；世界最大的盆地是非洲的刚果盆地，不存在“巴西盆地”这一“之最”称号；世界最高的山脉是喜马拉雅山脉而不是阿尔卑斯山脉。',
        commonMistake: '“最高/最大/最长”的搭配极易错位，建议列表对照记忆。',
        bookRef: '本书 P19 世界陆地地形之最表；课本 P46 图3-20'
      },
      reviewStatus: 'book_checked', reviewState: 'book_checked', example: false
    },

    /* ---- 以下 5 道 pending_book_check：web 来源（sourceType=keypoint, contentOrigin=web），
     * 照片未覆盖，需补拍学霸笔记 P20–21 / 课本 P48–49；绝不出现在练习池。 ---- */
    {
      id: 'GEO-C03-S02-K09-Q03', subject: 'geo',
      bookChapterId: 'GEO-C03', bookChapterTitle: '第三章 地球的面貌',
      bookSectionId: 'GEO-C03-S02', bookSectionTitle: '世界的地形',
      textbook: { version: 'XJ2024', chapter: '第三章 地球的面貌', section: '第二节 世界的地形' },
      contentOrigin: 'web', sourceType: 'keypoint', sourcePage: null,
      kpId: 'GEO-C03-S02-K09', kpTags: ['等高线特性', '等高距'],
      type: 'true_false', difficulty: 1,
      stem: { text: '同一幅等高线地形图上，相邻两条等高线的海拔差（等高距）相等。' },
      answer: { value: true },
      explanation: {
        summary: '同图等距：同一幅图中等高距处处相等。',
        detail: '依据等高线的基本特性：同一条等高线上各点海拔相同（同线等高），同一幅等高线地形图中相邻等高线的海拔差（等高距）处处相等（同图等距），因此该陈述正确。',
        commonMistake: '误以为不同区域的等高距可以随意变化，导致坡度比较出错。',
        bookRef: null
      },
      reviewStatus: 'draft', reviewState: 'pending_book_check', example: false
    },
    {
      id: 'GEO-C03-S02-K10-Q04', subject: 'geo',
      bookChapterId: 'GEO-C03', bookChapterTitle: '第三章 地球的面貌',
      bookSectionId: 'GEO-C03-S02', bookSectionTitle: '世界的地形',
      textbook: { version: 'XJ2024', chapter: '第三章 地球的面貌', section: '第二节 世界的地形' },
      contentOrigin: 'web', sourceType: 'keypoint', sourcePage: null,
      kpId: 'GEO-C03-S02-K10', kpTags: ['地形部位判读', '山脊与山谷'],
      type: 'true_false', difficulty: 2,
      stem: { text: '在等高线地形图上，等高线弯曲部分向高处凸出的部位是山脊。' },
      answer: { value: false },
      explanation: {
        summary: '向高处凸出的是山谷，不是山脊。',
        detail: '因为等高线弯曲部分向高处凸出时，该部位海拔比两侧低，是集水成河的山谷；山脊恰好相反，等高线向低处凸出、海拔比两侧高，常为分水岭。判读口诀可记为“凸高为谷，凸低为脊”，因此该陈述错误。',
        commonMistake: '山脊与山谷的凸出方向记反，是等高线判读最高频错误。',
        bookRef: null
      },
      reviewStatus: 'draft', reviewState: 'pending_book_check', example: false
    },
    {
      id: 'GEO-C03-S02-K02-Q06', subject: 'geo',
      bookChapterId: 'GEO-C03', bookChapterTitle: '第三章 地球的面貌',
      bookSectionId: 'GEO-C03-S02', bookSectionTitle: '世界的地形',
      textbook: { version: 'XJ2024', chapter: '第三章 地球的面貌', section: '第二节 世界的地形' },
      contentOrigin: 'web', sourceType: 'keypoint', sourcePage: null,
      kpId: 'GEO-C03-S02-K02', kpTags: ['海拔', '相对高度', '计算'],
      type: 'fill_blank', difficulty: 2,
      stem: { text: '珠穆朗玛峰海拔 8848.86 米，死海海拔约 -400 米，两地的相对高度约为________米。' },
      answer: { accept: ['9248.86', '9248.86米', '约9248.86', '约9248.86米', '9249', '9249米'], normalize: true },
      explanation: {
        summary: '相对高度 = 8848.86 - (-400) ≈ 9248.86 米。',
        detail: '因为相对高度是两地海拔之差：8848.86 减去（-400）等于 9248.86 米。计算时最常见的错误是误算成 8848.86 - 400，忘记死海海拔是负值——减去一个负值相当于加上它的绝对值。',
        commonMistake: '忽略死海海拔为负，错算成 8448.86 米。',
        bookRef: null
      },
      reviewStatus: 'draft', reviewState: 'pending_book_check', example: false
    },
    {
      id: 'GEO-C03-S02-K10-Q07', subject: 'geo',
      bookChapterId: 'GEO-C03', bookChapterTitle: '第三章 地球的面貌',
      bookSectionId: 'GEO-C03-S02', bookSectionTitle: '世界的地形',
      textbook: { version: 'XJ2024', chapter: '第三章 地球的面貌', section: '第二节 世界的地形' },
      contentOrigin: 'web', sourceType: 'keypoint', sourcePage: null,
      kpId: 'GEO-C03-S02-K10', kpTags: ['地形部位判读', '山峰'],
      type: 'single_choice', difficulty: 2,
      stem: { text: '在等高线地形图上，等高线闭合、数值从中间向四周逐渐降低的部位是？' },
      options: [
        { key: 'A', text: '山峰' }, { key: 'B', text: '鞍部' },
        { key: 'C', text: '山谷' }, { key: 'D', text: '陡崖' }
      ],
      answer: { value: 'A' },
      explanation: {
        summary: '闭合且中间高、四周低的是山峰。',
        detail: '依据地形部位判读规则：山峰的等高线闭合、数值从中间向四周逐渐降低；鞍部位于两个山峰之间相对低洼的部位；山谷的等高线向高处凸出；陡崖是多条等高线重合的地方。',
        commonMistake: '只看“闭合”忽略数值递变方向，与盆地（中间低四周高）混淆。',
        bookRef: null
      },
      reviewStatus: 'draft', reviewState: 'pending_book_check', example: false
    },
    {
      id: 'GEO-C03-S02-K09-Q09', subject: 'geo',
      bookChapterId: 'GEO-C03', bookChapterTitle: '第三章 地球的面貌',
      bookSectionId: 'GEO-C03-S02', bookSectionTitle: '世界的地形',
      textbook: { version: 'XJ2024', chapter: '第三章 地球的面貌', section: '第二节 世界的地形' },
      contentOrigin: 'web', sourceType: 'keypoint', sourcePage: null,
      kpId: 'GEO-C03-S02-K09', kpIdsSecondary: ['GEO-C03-S02-K10'], kpTags: ['等高线疏密与坡度', '读图题'],
      type: 'single_choice', difficulty: 3,
      stem: { text: '读某地等高线地形图（如图），图中甲处等高线密集、乙处等高线稀疏。若不考虑其他因素，坡度较陡的是哪一处？',
        imageNote: '配图未制作（规格见 docs/08 Q09），本题暂不可用' },
      options: [
        { key: 'A', text: '甲处，因为等高线密集表示坡度陡' },
        { key: 'B', text: '乙处，因为等高线稀疏表示坡度陡' },
        { key: 'C', text: '两处坡度相同，因为等高距相等' },
        { key: 'D', text: '无法判断，因为图中缺少比例尺' }
      ],
      answer: { value: 'A' },
      explanation: {
        summary: '等高线越密集，坡度越陡。',
        detail: '依据等高线特性：同一幅图中等高距相等，等高线越密集，表示单位水平距离内的高差越大，坡度越陡；甲处等高线密集，故坡度较陡。判断坡度只需看等高线疏密，不依赖比例尺。',
        commonMistake: '把“密集”误记为“平缓”，或被“等高距相等”误导而选“坡度相同”。',
        bookRef: null
      },
      reviewStatus: 'draft', reviewState: 'pending_book_check', example: false
    }
  ]
};
