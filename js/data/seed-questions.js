/* ============================================================================
 * seed-questions.js —— 题库与书目录树（内嵌数据，双击 index.html 即可用）
 *
 * 为什么用 JS 挂 window 而不是 fetch JSON：
 *   file:// 协议下浏览器会拦截 fetch 读本地文件，故题库内嵌为 window.XBJ_SEED。
 *
 * 入池红线（docs/04 + 2026-10-31 产品定义）：
 *   1. 只有 reviewStatus/reviewState === 'book_checked' 的题进入练习池；
 *      pending_book_check 的题随数据加载但【绝不出给学生】。
 *   2. contentOrigin = 'book'（书内来源：划重点/表格等，有真实内页照片依据）
 *      与 'web'（网络来源，sourceType=keypoint）在数据与界面上严格区分；
 *      练习池默认只用 book_checked 的书内题。
 *   3. 不得把网络通用知识伪装成“书里第 X 页的划重点”。
 *
 * 以后加题的路径约定（与 data/ 目录保持一致）：
 *   草稿仍放 data/drafts/<subj>_<章>_<节>.draft.json（JSON，供 SOP 核对）；
 *   核对通过后按章追加到本文件 QUESTIONS 数组（或新增 js/data/seed-<章>.js），
 *   每章一个数据块，加章不改代码。
 * ==========================================================================*/
window.XBJ_SEED = {
  meta: {
    bundleVersion: '1.1.0',
    schemaVersion: '1.1',
    generatedAt: '2026-10-31T00:00:00+08:00',
    note: '书目录（学霸笔记）为导航主键；教材章节降为映射字段。可用题=book_checked 的书内题。'
  },

  SUBJECTS: [
    { id: 'geo',  name: '地理', bookTitle: '初中学霸创新题·地理（湘教版）七上',  chapterUnit: '章' },
    { id: 'hist', name: '历史', bookTitle: '初中学霸创新题·历史（统编版）七上',  chapterUnit: '单元' },
    { id: 'bio',  name: '生物', bookTitle: '初中学霸创新题·生物（人教版）七上',  chapterUnit: '章' }
  ],

  /* 书目录树（学霸笔记内页目录，2026-10-30 照片转录，docs/01 第三节）。
   * page = 该节在书内的起始页码（书内页码，非教材页码）。 */
  TREES: {
    geo: [
      { id: 'GEO-C01', title: '第一章 让我们走进地理', mindmapPage: 'P1', sections: [
        { id: 'GEO-C01-S01', title: '我们身边的地理', page: 'P2' },
        { id: 'GEO-C01-S02', title: '我们怎样学地理', page: 'P3' } ] },
      { id: 'GEO-C02', title: '第二章 认识地球', mindmapPage: 'P6', sections: [
        { id: 'GEO-C02-S01', title: '地球与地球仪', page: 'P7' },
        { id: 'GEO-C02-S02', title: '地球的运动', page: 'P12' } ] },
      { id: 'GEO-C03', title: '第三章 地球的面貌', mindmapPage: 'P14', sections: [
        { id: 'GEO-C03-S01', title: '世界的海陆分布', page: 'P15' },
        { id: 'GEO-C03-S02', title: '世界的地形', page: 'P18' },
        { id: 'GEO-C03-S03', title: '海陆变迁', page: 'P22' } ] },
      { id: 'GEO-C04', title: '第四章 世界的居民与文化', mindmapPage: 'P25', sections: [
        { id: 'GEO-C04-S01', title: '世界的人口', page: 'P26' },
        { id: 'GEO-C04-S02', title: '世界的聚落', page: 'P30' },
        { id: 'GEO-C04-S03', title: '丰富多彩的世界文化', page: 'P32' } ] },
      { id: 'GEO-C05', title: '第五章 世界的气候', mindmapPage: 'P34', sections: [
        { id: 'GEO-C05-S01', title: '天气与天气预报', page: 'P35' },
        { id: 'GEO-C05-S02', title: '气温和降水', page: 'P37' },
        { id: 'GEO-C05-S03', title: '影响气候的因素', page: 'P42' },
        { id: 'GEO-C05-S04', title: '世界主要气候类型', page: 'P46' } ] },
      { id: 'GEO-C06', title: '第六章 世界的发展差异', mindmapPage: null, sections: [
        { id: 'GEO-C06-S01', title: '发展中国家与发达国家', page: 'P51' },
        { id: 'GEO-C06-S02', title: '国际合作', page: 'P54' } ] }
    ],
    hist: [
      { id: 'HIST-U01', title: '第一单元 史前时期', subtitle: '原始社会与中华文明的起源', mindmapPage: 'P1', sections: [
        { id: 'HIST-U01-L01', title: '第1课 远古时期的人类活动', page: 'P2' },
        { id: 'HIST-U01-L02', title: '第2课 原始农业与史前社会', page: 'P3' },
        { id: 'HIST-U01-L03', title: '第3课 中华文明的起源', page: 'P4' } ] },
      { id: 'HIST-U02', title: '第二单元 夏商周时期', subtitle: '奴隶制王朝的更替和向封建社会的过渡', mindmapPage: 'P5', sections: [
        { id: 'HIST-U02-L04', title: '第4课 夏商西周王朝的更替', page: 'P6' },
        { id: 'HIST-U02-L05', title: '第5课 动荡变化中的春秋时期', page: 'P8' },
        { id: 'HIST-U02-L06', title: '第6课 战国时期的社会变革', page: 'P9' },
        { id: 'HIST-U02-L07', title: '第7课 百家争鸣', page: 'P11' },
        { id: 'HIST-U02-L08', title: '第8课 夏商周时期的科技与文化', page: 'P13' } ] },
      { id: 'HIST-U03', title: '第三单元 秦汉时期', subtitle: '统一多民族封建国家的建立和巩固', mindmapPage: 'P14', sections: [
        { id: 'HIST-U03-L09', title: '第9课 秦统一中国', page: 'P15' },
        { id: 'HIST-U03-L10', title: '第10课 秦末农民大起义', page: 'P17' },
        { id: 'HIST-U03-L11', title: '第11课 西汉建立和“文景之治”', page: 'P18' },
        { id: 'HIST-U03-L12', title: '第12课 大一统王朝的巩固', page: 'P19' },
        { id: 'HIST-U03-L13', title: '第13课 东汉的兴衰', page: 'P21' },
        { id: 'HIST-U03-L14', title: '第14课 丝绸之路的开通与经营西域', page: 'P22' },
        { id: 'HIST-U03-L15', title: '第15课 秦汉时期的科技与文化', page: 'P24' } ] },
      { id: 'HIST-U04', title: '第四单元 三国两晋南北朝时期', subtitle: '政权分立与民族交融', mindmapPage: 'P26', sections: [
        { id: 'HIST-U04-L16', title: '第16课 三国鼎立', page: 'P27' },
        { id: 'HIST-U04-L17', title: '第17课 西晋的短暂统一和北方各族的内迁', page: 'P28' },
        { id: 'HIST-U04-L18', title: '第18课 东晋南朝政治和江南地区开发', page: 'P29' },
        { id: 'HIST-U04-L19', title: '第19课 北朝政治和北方民族大交融', page: 'P30' },
        { id: 'HIST-U04-L20', title: '第20课 三国两晋南北朝时期的科技与文化', page: 'P32' } ] }
    ],
    bio: [
      { id: 'BIO-U1-C01', title: '第一章 认识生物', unit: '第一单元 生物和细胞', sections: [
        { id: 'BIO-U1-C01-S01', title: '观察周边环境中的生物', page: 'P2' },
        { id: 'BIO-U1-C01-S02', title: '生物的特征', page: 'P3' } ] },
      { id: 'BIO-U1-C02', title: '第二章 认识细胞', unit: '第一单元 生物和细胞', sections: [
        { id: 'BIO-U1-C02-S01', title: '学习使用显微镜', page: 'P6' },
        { id: 'BIO-U1-C02-S02', title: '植物细胞', page: 'P9' },
        { id: 'BIO-U1-C02-S03', title: '动物细胞', page: 'P11' },
        { id: 'BIO-U1-C02-S04', title: '细胞的生活', page: 'P14' } ] },
      { id: 'BIO-U1-C03', title: '第三章 从细胞到生物体', unit: '第一单元 生物和细胞', sections: [
        { id: 'BIO-U1-C03-S01', title: '细胞通过分裂产生新细胞', page: 'P16' },
        { id: 'BIO-U1-C03-S02', title: '动物体的结构层次', page: 'P18' },
        { id: 'BIO-U1-C03-S03', title: '植物体的结构层次', page: 'P20' },
        { id: 'BIO-U1-C03-S04', title: '单细胞生物', page: 'P22' } ] },
      { id: 'BIO-U2-C01', title: '第一章 藻类与植物的类群', unit: '第二单元 多种多样的生物', sections: [
        { id: 'BIO-U2-C01-S01', title: '藻类、苔藓植物和蕨类植物', page: 'P26' },
        { id: 'BIO-U2-C01-S02', title: '种子植物', page: 'P29' } ] },
      { id: 'BIO-U2-C02', title: '第二章 动物的类群', unit: '第二单元 多种多样的生物', sections: [
        { id: 'BIO-U2-C02-S01', title: '无脊椎动物', page: 'P32' },
        { id: 'BIO-U2-C02-S02', title: '脊椎动物', page: 'P36' } ] },
      { id: 'BIO-U2-C03', title: '第三章 微生物', unit: '第二单元 多种多样的生物', sections: [
        { id: 'BIO-U2-C03-S01', title: '微生物的分布', page: 'P46' },
        { id: 'BIO-U2-C03-S02', title: '细菌', page: 'P49' },
        { id: 'BIO-U2-C03-S03', title: '真菌', page: 'P52' },
        { id: 'BIO-U2-C03-S04', title: '病毒', page: 'P55' } ] },
      { id: 'BIO-U2-C04', title: '第四章 生物分类的方法', unit: '第二单元 多种多样的生物', sections: [
        { id: 'BIO-U2-C04-S01', title: '尝试对生物进行分类', page: 'P57' },
        { id: 'BIO-U2-C04-S02', title: '从种到界', page: 'P60' } ] }
    ]
  },

  /* 来源类型（书内内容形态，docs/04 3.1a） */
  SOURCE_TYPES: {
    highlight: '划重点', table: '表格', mindmap: '思维导图', keypoint: '考点要点', figure: '图表判读'
  },

  /* 10 道样板题（地理·书第三章·世界的地形）。
   * book_checked 5 道（书内来源，页码已按 2026-10-30 照片回填）；
   * pending_book_check 5 道（web 来源，keypoint，不出给学生）。 */
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
