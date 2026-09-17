# plan.json v1

이 형식은 스킬의 편집 계획이다. video-slide의 가져오기 API나 Remotion의 기본 스키마가 아니다. 영상 제작에 사용할 때 선택한 렌더 프로젝트가 이 계획을 해석하게 하거나 계획의 타이밍을 같은 기준으로 사용한다.

## 필드

| 필드 | 뜻 |
|---|---|
| `version` | 형식 버전, 현재 1 |
| `title`, `language`, `finalSegmentTitle` | 영상 제목, 언어, 마지막 재생 구간 제목 |
| `fps`, `durationFrames` | 양의 정수 fps와 총 프레임 수 |
| `sources[]` | `{id, label, kind, url?}`, kind는 `reference`, `provided`, `illustrative` |
| `scenes[]` | 연속된 시각 장면. 처음은 0, 마지막 끝은 총 길이 |
| `scenes[].id`, `startFrame`, `endFrame` | 고유 ID와 반열린 구간 `[start, end)` |
| `scenes[].message` | 화면이 설명할 핵심 메시지 |
| `scenes[].effect` | `{id, reason}`, 효과 가이드 ID와 이 내용에서 고른 이유 |
| `scenes[].evidenceIds` | sources의 ID. 합성 예시는 illustrative 자료와 연결 |
| `scenes[].narration` | `{text, startFrame, endFrame}`. 최종 음성의 실제 범위로 갱신 |
| `scenes[].holds[]` | `{id, startFrame, endFrame, heading, audio}`. 읽을 수 있는 정적인 화면 구간, `audio`는 `quiet` |
| `breaks[]` | `{id, atFrame, holdId, completedTitle, presenterNotes}`. 시간순 중간 정지점 |

`completedTitle`은 해당 Break까지의 재생 구간 제목이다. `presenterNotes`는 그 정지점에서 발표자가 사용할 비공개 메모다. 생성기는 정확한 경계에서 다음 구간이 활성화되는 현재 video-slide 동작에 맞춰 다음 구간에 넣을 메모로 안내한다. 첫 구간의 도입 메모는 서비스에서 별도로 작성할 수 있다.

모든 프레임은 마스터 시작 기준이다. 장면별 상대 프레임을 섞지 않는다. 내레이션 범위와 hold는 같은 장면 안에 있어야 하며 겹치지 않아야 한다. 효과·BGM도 hold에서 안정되도록 렌더러가 구현해야 한다. JSON의 `audio: quiet` 선언만으로 실제 무음이 입증되지는 않는다.

Break는 영상의 처음/끝을 제외하고 인접 재생 경계와 최소 0.5초 간격을 유지한다. fps로 나눈 시간이 정확한 0.1초 단위여야 한다. 예: 30fps에서는 3프레임, 24fps에서는 12프레임(0.5초) 간격 값이 두 조건을 함께 만족한다. 맞지 않는 값을 조용히 반올림하지 않고 검증 오류로 알린다.

Break 주변 기본 여유는 각각 `ceil(fps × 0.6)` 프레임이며 같은 hold 안에 포함되어야 한다. 요약 화면은 시각 장면의 일부이므로 Break와 다음 장면 시작이 일치할 필요가 없다.

## 명령

Node.js 20 이상. 외부 패키지 설치가 필요 없다.

```bash
node scripts/plan.mjs validate assets/example.plan.json
node scripts/plan.mjs export assets/example.plan.json --out /absolute/path/to/new-handoff
npm test
```

내보내기는 존재하지 않는 새 출력 디렉터리에만 쓴다. 같은 이름의 이전 결과물을 덮어쓰지 않으므로 수정본은 `handoff-v2` 등 새 경로를 사용한다.

- `public-breaks.json`: 허용된 공개 필드만 새로 구성한 재생 구간과 Break 정보. 발표자 메모, 원본 대본, sources는 제외한다.
- `manual-breaks.md`: 실제 서비스에 입력할 시간·제목·정지 화면을 담은 공개 입력표.
- `presenter-notes.private.md`: 비공개 메모와 입력할 구간 번호. 파일 권한은 가능한 환경에서 소유자 읽기/쓰기로 제한한다.

구조·타이밍이 잘못되면 출력 전에 실패한다. public 파일은 제목·정지 화면에 사용자가 직접 비공개 내용을 적은 경우까지 자동 판별하지 못한다. 공개 전 문구 검토는 필요하다.

[예시](../assets/example.plan.json)는 90초짜리 합성 문제정의 설명 기획이다. 29초와 59초에 정지하며 30초와 60초에 시각 장면이 바뀐다. 실제 녹음·렌더링·게시된 영상은 아니고, 도구 검증과 내용 구성을 보여주는 예제이다.
