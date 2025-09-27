<template>
  <div class="rules-container">
    <!-- Header Section -->
    <div class="rules-header">
      <h2 class="rules-title">
        <span class="material-icons">rule</span>
        Правила турнира COD BO6 BABYLON
      </h2>
      <p class="rules-subtitle">
        Официальные правила и регламент проведения турниров
      </p>
    </div>

    <!-- Rules Content -->
    <div class="rules-content">
      <!-- General Rules -->
      <div class="rule-section">
        <h3 class="section-title">
          <span class="material-icons">sports_esports</span>
          Правила
        </h3>
        <div class="rule-list">
          <div class="rule-item">
            <span class="rule-number">1</span>
            <div class="rule-text">
              <strong>Термин</strong>
              <p>Термин - священна, термин всегда требует сайгы.</p>
            </div>
          </div>
          
          <div class="rule-item">
            <span class="rule-number">2</span>
            <div class="rule-text">
              <strong>Топух</strong>
              <p>Если игрок выходит с матча во время игры, то он получает -1 победу за этот день.</p>
            </div>
          </div>

          <div class="rule-item">
            <span class="rule-number">3</span>
            <div class="rule-text">
              <strong>Круг</strong>
              <p>Круг - это штурмовик, инженер, эшшек, дробовик, снайпер. Все игры, что нарушают круг не будут подсчитываться.</p>
            </div>
          </div>

          <div class="rule-item">
            <span class="rule-number">3</span>
            <div class="rule-text">
              <strong>Аглама Ислам</strong>
              <p>Нельзя использовать холодное оружие (кирку, катану и т.д) во время игры.</p>
            </div>
          </div>


          <div class="rule-item">
            <span class="rule-number">3</span>
            <div class="rule-text">
              <strong>Аглама Ислам 2.0</strong>
              <p>Все серии очков, кроме "телефона" и радара - запрещены.</p>
            </div>
          </div>

          <div class="rule-item">
            <span class="rule-number">3</span>
            <div class="rule-text">
              <strong>Вызов</strong>
              <p>Сезон - есть сезон, любые вызовы между игроками, которые нарушают священный круг, будут рассматриваться как несоревновательные игры и не будут подсчитываться.</p>
            </div>
          </div>


          <div class="rule-item">
            <span class="rule-number">3</span>
            <div class="rule-text">
              <strong>Аглама Лачо</strong>
              <p>Любые тактические гранаты, то есть оглушители, электрические ловушки и т.д. - запрещены. Можно использовать только шприц.</p>
            </div>
          </div>


          <div class="rule-item">
            <span class="rule-number">3</span>
            <div class="rule-text">
              <strong>Аглама Ислам 2.0</strong>
              <p>Все серии очков, кроме "телефона" и радара - запрещены.</p>
            </div>
          </div>
          
          <div class="rule-item">
            <span class="rule-number">4</span>
            <div class="rule-text">
              <strong>Ниндзя</strong>
              <p>Нельзя брать перк ниндзя, зачем тогда у всех такие ебейшие наушники?</p>
            </div>
          </div>

          <div class="rule-item">
            <span class="rule-number">5</span>
            <div class="rule-text">
              <strong>Дробовик</strong>
              <p>Во вермя игры с дробовиком, нельзя использовать гранаты, мины и тд.</p>
            </div>
          </div>
          
          <div class="rule-item">
            <span class="rule-number">6</span>
            <div class="rule-text">
              <strong>Подсчет очков</strong>
              <p>Очки начисляются за занятые места в матчах: 1-е место - 3 очка, 2-е место - 1 очко.</p>
            </div>
          </div>

          
        </div>
      </div>

      <!-- Scoring System -->
      <div class="rule-section">
        <h3 class="section-title">
          <span class="material-icons">emoji_events</span>
          Система начисления очков
        </h3>
        <div class="scoring-table">
          <div class="scoring-header">
            <span>Место</span>
            <span>Очки</span>
            <span>Описание</span>
          </div>
          <div class="scoring-row gold">
            <span class="position">1-е</span>
            <span class="points">3</span>
            <span class="description">Золото</span>
          </div>
          <div class="scoring-row silver">
            <span class="position">2-е</span>
            <span class="points">1</span>
            <span class="description">Серебро</span>
          </div>
          <div class="scoring-row bronze">
            <span class="position">3-е</span>
            <span class="points">0</span>
            <span class="description">Бронза</span>
          </div>
          <div class="scoring-row default">
            <span class="position">4-е и ниже</span>
            <span class="points">0</span>
            <span class="description">Без очков</span>
          </div>
        </div>
        
        <div class="tie-info">
          <h4 class="tie-title">
            <span class="material-icons">balance</span>
            Ничьи и разделение мест
          </h4>
          <div class="tie-rules">
            <div class="tie-rule">
              <div class="tie-icon">
                <span class="material-icons">emoji_events</span>
                <span class="material-icons">emoji_events</span>
              </div>
              <div class="tie-content">
                <strong>2 первых места</strong>
                <p>Каждый игрок получает 2.5 очка (среднее между 3 и 1)</p>
              </div>
            </div>
            <div class="tie-rule">
              <div class="tie-icon">
                <span class="material-icons">workspace_premium</span>
                <span class="material-icons">workspace_premium</span>
              </div>
              <div class="tie-content">
                <strong>2 вторых места</strong>
                <p>Каждый игрок получает 1.5 очка (среднее между 1 и 0)</p>
              </div>
            </div>
            <div class="tie-rule">
              <div class="tie-icon">
                <span class="material-icons">workspace_premium</span>
                <span class="material-icons">workspace_premium</span>
                <span class="material-icons">workspace_premium</span>
              </div>
              <div class="tie-content">
                <strong>3+ одинаковых места</strong>
                <p>Очки делятся поровну между всеми участниками</p>
              </div>
            </div>
          </div>
        </div>
      </div>


    </div>
  </div>
</template>

<script setup lang="ts">
// Rules tab component - displays tournament rules and regulations
</script>

<style scoped>
.rules-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.rules-header {
  text-align: center;
  margin-bottom: 40px;
  padding: 30px;
  background: rgba(255, 107, 53, 0.1);
  border: 1px solid rgba(255, 107, 53, 0.3);
  border-radius: 16px;
}

.rules-title {
  color: #ff6b35;
  margin: 0 0 10px 0;
  font-size: 2rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.rules-subtitle {
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
  font-size: 1.1rem;
}

.rules-content {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.rule-section {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 107, 53, 0.2);
  border-radius: 12px;
  padding: 24px;
  transition: all 0.3s ease;
}

.rule-section:hover {
  border-color: rgba(255, 107, 53, 0.4);
  background: rgba(255, 255, 255, 0.05);
}

.section-title {
  color: #ff6b35;
  margin: 0 0 20px 0;
  font-size: 1.4rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 2px solid rgba(255, 107, 53, 0.3);
}

.rule-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rule-item {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.rule-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-left-color: #ff6b35;
}

.rule-number {
  width: 32px;
  height: 32px;
  background: #ff6b35;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.rule-text {
  flex: 1;
}

.rule-text strong {
  color: #fff;
  font-size: 1.1rem;
  display: block;
  margin-bottom: 6px;
}

.rule-text p {
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
  line-height: 1.5;
}

/* Scoring Table */
.scoring-table {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.scoring-header {
  display: grid;
  grid-template-columns: 1fr 1fr 2fr;
  gap: 16px;
  padding: 16px 20px;
  background: rgba(255, 107, 53, 0.2);
  font-weight: 600;
  color: #ff6b35;
  border-bottom: 1px solid rgba(255, 107, 53, 0.3);
}

.scoring-row {
  display: grid;
  grid-template-columns: 1fr 1fr 2fr;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.3s ease;
}

.scoring-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

.scoring-row:last-child {
  border-bottom: none;
}

.scoring-row.gold {
  border-left: 4px solid #ffd700;
}

.scoring-row.silver {
  border-left: 4px solid #c0c0c0;
}

.scoring-row.bronze {
  border-left: 4px solid #cd7f32;
}

.scoring-row.default {
  border-left: 4px solid #6c757d;
}

.position {
  font-weight: 600;
  color: #fff;
}

.points {
  font-weight: 700;
  color: #ff6b35;
  font-size: 1.1rem;
}

.description {
  color: rgba(255, 255, 255, 0.8);
}

/* Tie Information */
.tie-info {
  margin-top: 24px;
  padding: 20px;
  background: rgba(255, 107, 53, 0.05);
  border: 1px solid rgba(255, 107, 53, 0.2);
  border-radius: 10px;
}

.tie-title {
  color: #ff6b35;
  margin: 0 0 16px 0;
  font-size: 1.2rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 107, 53, 0.3);
}

.tie-rules {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tie-rule {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.tie-rule:hover {
  background: rgba(255, 255, 255, 0.05);
  border-left-color: #ff6b35;
}

.tie-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-shrink: 0;
  min-width: 60px;
}

.tie-icon .material-icons {
  color: #ff6b35;
  font-size: 20px;
}

.tie-content {
  flex: 1;
}

.tie-content strong {
  color: #fff;
  font-size: 1rem;
  display: block;
  margin-bottom: 4px;
}

.tie-content p {
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
}


/* Responsive Design */
@media (max-width: 768px) {
  .rules-container {
    padding: 10px;
  }

  .rules-header {
    padding: 20px;
    margin-bottom: 30px;
  }

  .rules-title {
    font-size: 1.6rem;
    flex-direction: column;
    gap: 8px;
  }

  .rules-subtitle {
    font-size: 1rem;
  }

  .rule-section {
    padding: 16px;
  }

  .section-title {
    font-size: 1.2rem;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .rule-item {
    flex-direction: column;
    gap: 12px;
    padding: 12px;
  }

  .rule-number {
    align-self: flex-start;
  }

  .scoring-header,
  .scoring-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .scoring-header {
    display: none;
  }

  .scoring-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .scoring-row::before {
    content: attr(data-label);
    font-weight: 600;
    color: #ff6b35;
    margin-bottom: 4px;
  }

  .tie-info {
    margin-top: 16px;
    padding: 16px;
  }

  .tie-title {
    font-size: 1.1rem;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .tie-rule {
    flex-direction: column;
    gap: 12px;
    text-align: center;
    padding: 12px;
  }

  .tie-icon {
    gap: 6px;
    min-width: 80px;
  }

  .tie-icon .material-icons {
    font-size: 24px;
  }

}

/* Animation */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.rule-section {
  animation: fadeInUp 0.6s ease-out;
}

.rule-section:nth-child(2) { animation-delay: 0.1s; }
</style>
