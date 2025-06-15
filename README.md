# CG Term PJ - HM

Three.js 기반으로 효과 추가한 작업물입니다.

---

## 주요 수정사항

### [1] 연기 효과 (Smoke Effect)

- `SmokeParticle` 클래스를 통해 화면 전반에 잔잔한 연기 입자를 생성합니다.
- 레벨에 따라 연기 생성 **확률 및 파티클 개수**를 조절합니다.
- 각 파티클은 랜덤한 **수명, 크기, 투명도, 속도, 회전 값**을 가지며 자연스러운 연출을 구현합니다.

### [2] 레벨별 뿌옇기 효과 (Haze per Level)

- **레벨 1**: 연기 생성 없음
- **레벨 2~3**: 화면 하단에서 잔잔하게 연기 1개씩 생성
- **레벨 4 이상**: 레벨에 비례해 최대 3개까지 생성
- `pollutionOverlay`의 `opacity = 0.1 * level`로 뿌옇기 조절 (최대 0.5)

### [3] 경고 메시지 (Warning Message)

- 게임 오버 시, 전체 화면에 **검정 오버레이(blackout-overlay)** 생성
- 중앙에 **깜빡이는 경고 텍스트(power-warning)** 표시
- `@keyframes blink` CSS 애니메이션으로 깜빡이는 효과 구현

### [4] 공익 메시지 (Public Service Message)

- 경고 텍스트 하단에 다음 문구가 표시됩니다:  
  > "Overuse of AI may harm the environment and energy supply."
- HTML 요소로 동적으로 생성되어 원하는 위치에 삽입됩니다.

---

## 설치 및 사용법 관련 추가사항

### 1. 텍스처 image 추가 (texture 폴더 및 해당 폴더 내 이미지 하나 추가)

- `/textures/smoke.png` 경로에 연기 텍스처 이미지를 배치합니다.

### 2. 코드 삽입 위치

- `SmokeParticle` 클래스 및 `smokeManager` 정의부에 파티클 로직 삽입
- `spawnBackgroundSmoke()` 함수 생성 후 `loop()` 또는 `Airplane.tick()`에서 호출
- `pollutionOverlay`, `blackout-overlay`, `power-warning` 등의 HTML 요소는 초기화 시점에 생성

---

## 🧪 게임 레벨 테스트

| 레벨 | 효과 |
|------|------|
| 1    | 연기 없음 |
| 2~3  | 잔잔한 연기 1개씩 생성 |
| 4+   | 최대 3개까지 생성, 배경 뿌옇기 증가 |
| Game Over | 검정 오버레이 + 경고 메시지 표시 |
