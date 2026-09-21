"""文本分析：拼音转换 + 基于关键词的情感打分。

设计取舍（面试可讲）：
- 拼音用 `pypinyin`，不自己维护字典表——这是成熟的轮子，没必要重造。
- 情感判断**故意不上模型**：本项目要的是一个"可解释、零依赖、毫秒级"的规则打分，
  每条分值都能说清是哪几个词贡献的。上模型会把项目变成"调 API"，反而丢掉了
  自己对"打分逻辑"的表达。规则化的代价是精度有限，这一点在文档里如实写明。
"""

import re

from pypinyin import Style, lazy_pinyin

# ---------------------------------------------------------------- 拼音

# 这些标点前后都不该有空格（中文标点是全角的，本来就不需要空格补位）
_NO_SPACE_AROUND = "，。！？；：、）」』》】…—"
# 开括号只吃后面的空格，闭括号只吃前面的空格
_OPEN_BRACKETS = "（「『《【"
_CLOSE_BRACKETS = "）』」》】"


def to_pinyin(text: str) -> str:
    """把中文转成带声调的拼音，音节之间用空格分隔，标点保留。

    >>> to_pinyin("今天很好")
    'jīn tiān hěn hǎo'
    """
    # lazy_pinyin 把每个汉字转成一个音节，非汉字（英文、数字、标点、空白）原样保留。
    # 所以这里不能简单地 " ".join()：原文里的空格本身就是 token，
    # 直接 join 会拼出 "Hello  shì jiè  123" 这种双空格。
    pieces: list[str] = []
    for token in lazy_pinyin(text, style=Style.TONE):
        if not token.strip():
            # 纯空白 token：换行照原样保留，其余压成一个空格
            pieces.append("\n" if "\n" in token else " ")
            continue
        if pieces and not pieces[-1].endswith((" ", "\n")):
            pieces.append(" ")  # 音节之间补一个分隔空格
        pieces.append(token)

    pinyin = "".join(pieces)
    pinyin = re.sub(rf"\s+([{re.escape(_NO_SPACE_AROUND + _CLOSE_BRACKETS)}])", r"\1", pinyin)
    pinyin = re.sub(rf"([{re.escape(_OPEN_BRACKETS)}])\s+", r"\1", pinyin)
    pinyin = re.sub(rf"([{re.escape(_NO_SPACE_AROUND)}])\s+", r"\1", pinyin)
    pinyin = re.sub(r"[ \t]{2,}", " ", pinyin)
    return pinyin.strip()


# ---------------------------------------------------------------- 情感

# 正向 / 负向词表。命中一个记一份权重，累加后从 0.5（中性）向上或向下偏移。
POSITIVE_WORDS = (
    "开心", "高兴", "快乐", "幸福", "喜欢", "热爱", "美好", "温柔", "温暖", "希望",
    "期待", "惊喜", "感动", "顺利", "成功", "优秀", "棒", "赞", "轻松", "安静",
    "平静", "满足", "满意", "感谢", "值得", "认真", "努力", "进步", "阳光", "晴朗",
    "春天", "笑", "甜", "美丽", "漂亮", "舒服", "自由", "勇敢", "坚定", "加油",
    "治愈", "可爱", "幸运", "完美", "精彩", "宁静", "踏实", "充实", "不错", "挺好",
    "真好", "太好了", "有意思", "享受",
)

NEGATIVE_WORDS = (
    "难过", "伤心", "悲伤", "痛苦", "失望", "绝望", "焦虑", "压力", "疲惫", "孤独",
    "寂寞", "害怕", "恐惧", "生气", "愤怒", "讨厌", "糟糕", "失败", "错误", "后悔",
    "遗憾", "无聊", "空虚", "崩溃", "烦", "郁闷", "沮丧", "压抑", "冷漠", "争吵",
    "抱怨", "担心", "紧张", "不安", "眼泪", "哭", "疼", "失去", "离开", "分手",
    "失业", "倒霉", "丑陋", "烂", "沉重", "灰暗", "好累", "很累", "没意思",
)

# 否定词：紧贴在词前面时把语义反转（"不开心" 应当算消极而不是积极）
NEGATION_CHARS = "不没无别非莫"

# 例外：这些词本身就带着否定字，但语义是正向的，不能再被上面的规则反转
NEGATION_EXCEPTIONS = ("不错", "不赖", "不要紧", "没关系", "无所谓", "不得了", "不虚此行")

WORD_WEIGHT = 0.12      # 单个词命中的基础权重
MAX_CONTRIBUTION = 0.45  # 单向最多偏离中性多少（避免一句话刷分刷到 0 或 1）
POSITIVE_THRESHOLD = 0.6  # ≥ 判为偏积极
NEGATIVE_THRESHOLD = 0.4  # ≤ 判为偏消极


def _count_hits(text: str, words: tuple[str, ...]) -> tuple[int, int]:
    """返回 (普通命中次数, 被否定词反转的次数)。"""
    hits = 0
    negated = 0
    for word in words:
        # 词本身就带否定字（"不错"）时不做反转判断，否则会自己把自己判成消极
        check_negation = word not in NEGATION_EXCEPTIONS
        start = 0
        while True:
            index = text.find(word, start)
            if index == -1:
                break
            # 看词前面一个字是不是否定词（"不开心" 里的 "不"）
            if check_negation and index > 0 and text[index - 1] in NEGATION_CHARS:
                negated += 1
            else:
                hits += 1
            start = index + len(word)
    return hits, negated


def analyze_sentiment(text: str) -> tuple[float, str]:
    """返回 (score, label)。score 在 0~1 之间，0.5 为中性。

    >>> analyze_sentiment("今天很开心")
    (0.62, '偏积极')
    """
    positive, positive_negated = _count_hits(text, POSITIVE_WORDS)
    negative, negative_negated = _count_hits(text, NEGATIVE_WORDS)

    # 被否定的正向词其实是消极信号，反之亦然
    positive += negative_negated
    negative += positive_negated

    # 同类词只累计到上限，避免"好好好好好"把分数推满
    positive_part = min(positive * WORD_WEIGHT, MAX_CONTRIBUTION)
    negative_part = min(negative * WORD_WEIGHT, MAX_CONTRIBUTION)

    score = round(0.5 + positive_part - negative_part, 2)
    score = max(0.0, min(1.0, score))
    return score, label_for(score)


def label_for(score: float) -> str:
    if score >= POSITIVE_THRESHOLD:
        return "偏积极"
    if score <= NEGATIVE_THRESHOLD:
        return "偏消极"
    return "中性"


def analyze(text: str) -> dict:
    """一次调用拿到分析结果，接口层直接用这个。"""
    score, label = analyze_sentiment(text)
    return {"text": text, "pinyin": to_pinyin(text), "score": score, "label": label}
