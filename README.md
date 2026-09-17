# Build Explainer Video

프레젠테이션·강의·워크숍 내용을 **혼자 시청해도 이해되는 설명 영상**으로 만들고, 같은 영상을 [video-slide](https://video--slide.web.app/)에서 멈춰 발표할 수 있도록 설계하는 전역 Codex 스킬입니다.

내용에 따라 효과를 고르는 가이드가 중심입니다. 첫 버전은 효과 16종의 선택 기준, 대본·화면·음향 제작 지침, Break 설계, 계획 검증기와 수동 입력 자료 생성기를 제공합니다. 실제 발표를 제작하면서 검증된 패턴을 지속적으로 보완합니다.

## 어떻게 쓰나요?

```text
$build-explainer-video
이 내용을 처음 듣는 사람도 이해할 수 있는 배포용 설명 영상으로 구성해줘.
내용에 맞는 효과와 선택 이유를 정하고, 같은 영상을 video-slide로 발표할 수 있게
질문·요약 화면의 Break 시점과 비공개 발표자 메모도 만들어줘.
이번 제작에서 검증한 재사용 가능한 연출은 스킬에도 반영해줘.
```

원고·기존 슬라이드·설명할 주제를 함께 제공하면 됩니다. 기획만 요청하면 대본과 장면·Break 계획을, 제작까지 요청하면 환경에 맞는 렌더 도구로 실제 영상까지 완성하는 지침을 담고 있습니다.

## 설치

Codex의 전역 스킬 경로에 설치합니다. 같은 폴더가 이미 있으면 새로 덮어쓰지 말고 기존 변경을 확인하세요.

```bash
git clone https://github.com/SJ578Park/build-explainer-video.git \
  ~/.codex/skills/build-explainer-video
```

환경에서 별도의 `CODEX_HOME`을 사용한다면 해당 경로의 `skills`에 설치합니다. 스킬이 새 세션에서 발견되면 `$build-explainer-video`로 호출할 수 있습니다. 문서만 사용하는 경우 [SKILL.md](SKILL.md)부터 읽으면 됩니다.

## 내용별 효과

| 설명할 관계 | 대표 효과 |
|---|---|
| 정의·주장 | 키워드 등장, 문장 재구성 |
| 구성·비교 | 카드 강조, 같은 축 비교, 전후 비교 |
| 과정·원인 | 흐름 연결, 병목 강조, 관계 지도 |
| 수치·시간 | 비율 채움, 기간 막대, 시간축 |
| 근거·사례 | 자료 확대, 실제 화면 강조, 전체 화면 자료 |
| 문제 재정의·실습 | 재정의, 사례 누적, 질문 정지 화면 |

각 효과를 **언제 쓰고, 어떤 움직임으로 설명하며, 어느 상태에서 멈출지**는 [효과 가이드](references/effects.md)에 정리되어 있습니다. [참고 영상 관찰 기록](references/research.md)은 영상·시점·직접 관찰한 구성과 제작 제안을 구분합니다.

## 배포 영상과 발표의 연결

```text
내용·근거 → 대본·장면·효과 → 내레이션이 있는 완성 영상 → YouTube 배포
                   └→ 안정된 요약/질문 화면의 Break → video-slide 발표
```

영상에는 필요한 설명을 모두 담고, 현장 질문과 추가 설명은 비공개 메모에 둡니다. 예를 들어 요약 화면을 28–30초에 유지하고 29초에 Break를 두면, 배포 영상은 짧게 쉬고 이어지며 발표자는 같은 화면에서 원하는 만큼 설명할 수 있습니다.

현재 video-slide는 YouTube 재생과 수동 Break 편집을 지원합니다. 이 스킬의 JSON은 서비스가 자동 가져오는 파일이 아닙니다. [연동 가이드](references/video-slide.md)에 실제 서비스 입력과 메모 매핑·리허설 절차가 있습니다.

## 계획 검증과 자료 생성

Node.js 20 이상, 외부 npm 의존성 없음.

```bash
npm test
npm run validate:example
node scripts/plan.mjs export assets/example.plan.json --out /tmp/explainer-handoff-v1
```

출력 경로는 새 디렉터리여야 합니다. 생성물은 공개 수동 입력표, 공개 Break JSON, 별도 비공개 발표자 메모입니다. 예시 계획은 90초·29초/59초 Break의 합성 기획이며, 음성·영상으로 제작된 데모는 아닙니다.

검증기는 프레임 연속성, 안정된 정지 구간, 음성 구간과의 충돌, 0.1초 입력 정렬, 공개 자료의 필드 분리를 점검합니다. 렌더링·YouTube 업로드·서비스 입력·실제 영상의 픽셀/음향 검증은 수행하지 않습니다.

## 문서

- [스킬 진입점](SKILL.md)
- [내용별 효과 가이드](references/effects.md)
- [대본·화면·음향과 검증](references/production.md)
- [video-slide 연동](references/video-slide.md)
- [계획 형식과 예제](references/plan-format.md)
- [제작 경험을 반영하는 개선 절차](references/evolution.md)

## 기원과 라이선스

[build-service-guide-video](https://github.com/SJ578Park/build-service-guide-video)의 편집 원본·증거·프레임 검증 원칙을 참고해 독립적으로 구성했습니다. 기존 스킬 설치에 의존하지 않습니다. GitHub의 fork 관계로 연결된 저장소는 아닙니다.

머니스웨거 영상의 설명 구성을 연구했으며 채널과 제휴한 스킬은 아닙니다. 원본 영상·음원·로고·캡처 이미지를 번들하지 않습니다. 관찰에서 도출한 일반적인 설명 원리로 각 발표의 고유한 화면을 만듭니다.

스킬의 코드와 문서는 [MIT](LICENSE)입니다. 외부 참고 자료와 제작에 사용하는 자산의 권리는 각 원저작자에게 있습니다.
