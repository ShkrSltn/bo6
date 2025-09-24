<script setup lang="ts">
import { ref } from 'vue'
import type { Season, DatabasePlayer } from '@/lib/supabase'

// Props
const props = defineProps<{
  globalPlayers: DatabasePlayer[]
  seasons: Season[]
  isLoading: boolean
}>()

// Emits
const emit = defineEmits<{
  createGlobalPlayer: [name: string]
  updateGlobalPlayerName: [playerId: number, name: string]
  deleteGlobalPlayer: [playerId: number]
}>()

// Local reactive data
const newPlayerName = ref('')
const editingGlobalPlayer = ref<{ id: number; name: string } | null>(null)
const showPlayerDetails = ref<{ [key: number]: boolean }>({})

// Helper functions
const getSeasonsForPlayer = (playerId: number) => {
  return props.seasons.filter(season =>
    season.players.some(p => p.playerId === playerId)
  )
}

const getTotalWinsForPlayer = (playerId: number) => {
  return props.seasons.reduce((total, season) => {
    const player = season.players.find(p => p.playerId === playerId)
    return total + (player?.wins || 0)
  }, 0)
}

const getTotalMatchWinsForPlayer = (playerId: number) => {
  return props.seasons.reduce((total, season) => {
    return total + season.matches.reduce((matchTotal, match) => {
      const playerInMatch = match.players.find(p => p.playerId === playerId)
      return matchTotal + (playerInMatch?.winsInMatch || 0)
    }, 0)
  }, 0)
}

const getSeasonWinsForPlayer = (playerId: number) => {
  return props.seasons.reduce((total, season) => {
    if (season.players.length === 0) return total

    const maxPoints = Math.max(...season.players.map(p => p.points))
    const seasonWinners = season.players
      .filter(p => p.points === maxPoints)
      .map(p => p.playerId)

    return total + (seasonWinners.includes(playerId) ? 1 : 0)
  }, 0)
}

const getDetailedPlayerStats = (playerId: number) => {
  const stats = {
    totalMatches: 0,
    totalVictories: 0,
    totalPoints: 0,
    seasonWins: 0,
    positionStats: {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0
    },
    seasonsParticipated: 0,
    averagePosition: 0,
    averagePoints: 0,
    averageVictoriesPerMatch: 0,
    bestPosition: null as number | null,
    worstPosition: null as number | null
  }

  let totalPositionSum = 0
  let matchCount = 0

  props.seasons.forEach(season => {
    const playerInSeason = season.players.find(p => p.playerId === playerId)
    if (playerInSeason) {
      stats.seasonsParticipated++
      stats.totalPoints += playerInSeason.points

      if (season.players.length > 0) {
        const maxPoints = Math.max(...season.players.map(p => p.points))
        const seasonWinners = season.players.filter(p => p.points === maxPoints)
        if (seasonWinners.some(w => w.playerId === playerId)) {
          stats.seasonWins++
        }
      }

      season.matches.forEach(match => {
        const playerInMatch = match.players.find(p => p.playerId === playerId)
        if (playerInMatch) {
          stats.totalMatches++
          matchCount++
          stats.totalVictories += playerInMatch.winsInMatch || 0

          const position = playerInMatch.position
          if (position >= 1 && position <= 6) {
            stats.positionStats[position as keyof typeof stats.positionStats]++
            totalPositionSum += position

            if (stats.bestPosition === null || position < stats.bestPosition) {
              stats.bestPosition = position
            }
            if (stats.worstPosition === null || position > stats.worstPosition) {
              stats.worstPosition = position
            }
          }
        }
      })
    }
  })

  if (matchCount > 0) {
    stats.averagePosition = Math.round((totalPositionSum / matchCount) * 100) / 100
    stats.averagePoints = Math.round((stats.totalPoints / matchCount) * 100) / 100
    stats.averageVictoriesPerMatch = Math.round((stats.totalVictories / matchCount) * 100) / 100
  }

  return stats
}

const getPositionCount = (playerId: number, position: number) => {
  const stats = getDetailedPlayerStats(playerId)
  return stats.positionStats[position as keyof typeof stats.positionStats] || 0
}

// Global player management functions
const createGlobalPlayer = () => {
  if (!newPlayerName.value.trim() || props.isLoading) return
  emit('createGlobalPlayer', newPlayerName.value.trim())
  newPlayerName.value = ''
}

const startEditingGlobalPlayer = (player: DatabasePlayer) => {
  editingGlobalPlayer.value = { id: player.id, name: player.name }
}

const cancelEditingGlobalPlayer = () => {
  editingGlobalPlayer.value = null
}

const saveGlobalPlayerEdit = () => {
  if (!editingGlobalPlayer.value || props.isLoading) return
  emit('updateGlobalPlayerName', editingGlobalPlayer.value.id, editingGlobalPlayer.value.name)
  editingGlobalPlayer.value = null
}

const deleteGlobalPlayerConfirm = (playerId: number) => {
  const player = props.globalPlayers.find(p => p.id === playerId)
  if (!player) return

  const participatingSeasons = getSeasonsForPlayer(playerId)
  let confirmMessage = `Вы уверены, что хотите удалить игрока "${player.name}"?`

  if (participatingSeasons.length > 0) {
    confirmMessage += `\n\nВнимание: Игрок участвует в ${participatingSeasons.length} сезонах. Вся его статистика будет удалена!`
  }

  if (confirm(confirmMessage)) {
    emit('deleteGlobalPlayer', playerId)
  }
}

const togglePlayerDetails = (playerId: number) => {
  showPlayerDetails.value[playerId] = !showPlayerDetails.value[playerId]
}
</script>

<template>
  <div class="players-mode">
    <!-- Global Players Management Section -->
    <section class="players-management-section">
      <h2 class="section-title">Управление игроками</h2>

      <!-- Create New Player -->
      <div class="create-player-form">
        <input 
          v-model="newPlayerName" 
          @keyup.enter="createGlobalPlayer" 
          placeholder="Введите имя нового игрока..."
          class="player-name-input" 
          :disabled="isLoading" 
        />
        <button 
          @click="createGlobalPlayer" 
          class="create-player-btn" 
          :disabled="isLoading"
        >
          <span class="material-icons">person_add</span>
          {{ isLoading ? 'Загрузка...' : 'Создать игрока' }}
        </button>
      </div>

      <!-- Global Players List -->
      <div v-if="globalPlayers.length > 0" class="global-players-section">
        <h3>Все игроки:</h3>
        <div class="global-players-list">
          <div v-for="player in globalPlayers" :key="player.id" class="global-player-card">
            <div v-if="editingGlobalPlayer?.id === player.id" class="global-player-edit">
              <input v-model="editingGlobalPlayer.name" @keyup.enter="saveGlobalPlayerEdit"
                @keyup.esc="cancelEditingGlobalPlayer" class="input" :disabled="isLoading" />
              <div class="edit-controls">
                <button @click="saveGlobalPlayerEdit" class="btn btn-success btn-small" :disabled="isLoading">
                  <span class="material-icons">save</span>
                </button>
                <button @click="cancelEditingGlobalPlayer" class="btn btn-secondary btn-small">
                  <span class="material-icons">close</span>
                </button>
              </div>
            </div>

            <div v-else class="global-player-info">
              <div class="global-player-details">
                <span class="global-player-name" @dblclick="startEditingGlobalPlayer(player)">{{ player.name
                  }}</span>
                <div class="global-player-meta">
                  <span class="seasons-count">
                    <span class="material-icons">calendar_today</span>
                    {{ getSeasonsForPlayer(player.id).length }} сезонов
                  </span>
                  <span class="season-wins">
                    <span class="material-icons">emoji_events</span>
                    {{ getSeasonWinsForPlayer(player.id) }} чемпионств
                  </span>
                  <span class="total-wins">
                    <span class="material-icons">military_tech</span>
                    {{ getTotalWinsForPlayer(player.id) }} побед
                  </span>
                  <span class="match-victories">
                    <span class="material-icons">trending_up</span>
                    {{ getTotalMatchWinsForPlayer(player.id) }} матчей
                  </span>
                </div>
              </div>
              <div class="global-player-controls">
                <button @click="togglePlayerDetails(player.id)" class="btn btn-secondary btn-small">
                  <span class="material-icons">{{ showPlayerDetails[player.id] ? 'expand_less' : 'expand_more'
                    }}</span>
                  Детали
                </button>
                <button @click="startEditingGlobalPlayer(player)" class="btn btn-secondary btn-small">
                  <span class="material-icons">edit</span>
                </button>
                <button @click="deleteGlobalPlayerConfirm(player.id)" class="btn btn-danger btn-small">
                  <span class="material-icons">delete</span>
                </button>
              </div>
            </div>

            <!-- Детальная статистика игрока -->
            <div v-if="showPlayerDetails[player.id]" class="player-detailed-stats">
              <h4>Детальная статистика: {{ player.name }}</h4>

              <div class="stats-overview">
                <div class="stats-row">
                  <div class="stat-card">
                    <div class="stat-number">{{ getDetailedPlayerStats(player.id).totalMatches }}</div>
                    <div class="stat-label">Всего участий (дней) </div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-number">{{ getDetailedPlayerStats(player.id).totalVictories }}</div>
                    <div class="stat-label">Всего побед в играх</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-number">{{ getDetailedPlayerStats(player.id).totalPoints }}</div>
                    <div class="stat-label">Всего очков</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-number">{{ getDetailedPlayerStats(player.id).seasonsParticipated }}</div>
                    <div class="stat-label">Сезонов участий</div>
                  </div>
                </div>

                <div class="stats-row">
                  <div class="stat-card">
                    <div class="stat-number">{{ getDetailedPlayerStats(player.id).averagePosition }}</div>
                    <div class="stat-label">Среднее место</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-number">{{ getDetailedPlayerStats(player.id).averageVictoriesPerMatch }}</div>
                    <div class="stat-label">Средние победы/матч</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-number">{{ getDetailedPlayerStats(player.id).bestPosition || 'N/A' }}</div>
                    <div class="stat-label">Лучшее место</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-number">{{ getDetailedPlayerStats(player.id).worstPosition || 'N/A' }}</div>
                    <div class="stat-label">Худшее место</div>
                  </div>
                </div>
              </div>

              <!-- Распределение по местам -->
              <div class="positions-breakdown">
                <h5>Распределение по местам</h5>
                <div class="position-stats">
                  <div v-for="position in [1, 2, 3, 4, 5, 6]" :key="position" class="position-stat"
                    :class="`position-${position}`">
                    <div class="position-icon">{{ position }}</div>
                    <div class="position-count">{{ getPositionCount(player.id, position) }}
                    </div>
                    <div class="position-label">{{ position === 1 ? 'место' : position === 2 ? 'место' : position
                      === 3 ? 'место' : position === 4 ? 'место' : position === 5 ? 'место' : 'место' }}</div>
                  </div>
                </div>
              </div>

              <!-- Процентное соотношение -->
              <div class="percentage-breakdown" v-if="getDetailedPlayerStats(player.id).totalMatches > 0">
                <h5>Процентное соотношение</h5>
                <div class="percentage-stats">
                  <div v-for="position in [1, 2, 3, 4, 5, 6]" :key="position" class="percentage-bar">
                    <div class="percentage-label">{{ position }} место</div>
                    <div class="progress-bar-container">
                      <div class="progress-bar-fill" :class="`position-${position}-bg`"
                        :style="{ width: `${(getPositionCount(player.id, position) / getDetailedPlayerStats(player.id).totalMatches * 100)}%` }">
                      </div>
                    </div>
                    <div class="percentage-value">
                      {{ Math.round((getPositionCount(player.id, position) /
                        getDetailedPlayerStats(player.id).totalMatches * 100)) }}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Players Mode Styles */
.players-mode {
  animation: fadeIn 0.3s ease-in;
}

/* Players Management Section */
.players-management-section {

  border-radius: 8px;
  padding: 24px;
  margin-bottom: 32px;
  border: 1px solid rgba(255, 107, 53, 0.2);
}

.section-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #ff6b35;
  margin-bottom: 24px;
}

/* Create Player Form */
.create-player-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

@media (min-width: 640px) {
  .create-player-form {
    flex-direction: row;
  }
}

.player-name-input {
  flex: 1;
  border: 2px solid #4b5563;
  border-radius: 8px;
  padding: 12px 16px;
  color: white;
  transition: border-color 0.2s ease;
}

.player-name-input::placeholder {
  color: #9ca3af;
}

.player-name-input:focus {
  border-color: #ff6b35;
  outline: none;
}

.player-name-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.create-player-btn {
  background: #ff6b35;
  color: white;
  font-weight: 600;
  padding: 12px 24px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.create-player-btn:hover {
  background: #e55a2b;
}

.create-player-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Global Players Management Styles */
.global-players-section {
  margin: 30px 0;
}

.global-players-section h3 {
  margin: 0 0 20px 0;
  color: #ff6b35;
  font-weight: 600;
}

.global-players-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.global-player-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 107, 53, 0.2);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
}

.global-player-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 107, 53, 0.4);
}

.global-player-edit {
  display: flex;
  align-items: center;
  gap: 15px;
}

.global-player-edit .input {
  flex: 1;
}

.edit-controls {
  display: flex;
  gap: 8px;
}

.global-player-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.global-player-details {
  flex: 1;
}

.global-player-name {
  font-size: 1.2rem;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  margin-bottom: 8px;
  display: block;
}

.global-player-name:hover {
  color: #ff6b35;
}

.global-player-meta {
  display: flex;
  gap: 20px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
}

.seasons-count,
.season-wins,
.total-wins,
.match-victories {
  display: flex;
  align-items: center;
  gap: 4px;
}

.global-player-meta .material-icons {
  font-size: 16px;
  color: #ff6b35;
}

.global-player-controls {
  display: flex;
  gap: 8px;
}

/* Детальная статистика игроков */
.player-detailed-stats {
  margin-top: 16px;
  padding: 16px;
}

.player-detailed-stats h4 {
  margin: 0 0 12px 0;
  color: #ff6b35;
  font-weight: 600;
  font-size: 1.2rem;
}

.player-detailed-stats h5 {
  margin: 12px 0 8px 0;
  color: #ff6b35;
  font-weight: 500;
  font-size: 1rem;
}

/* Обзор статистики */
.stats-overview {
  margin-bottom: 16px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 107, 53, 0.3);
  border-radius: 6px;
  padding: 10px;
  text-align: center;
  transition: background-color 0.2s ease;
}

.stat-card:hover {
  background: rgba(255, 255, 255, 0.08);
}

.stat-number {
  font-size: 1.4rem;
  font-weight: 600;
  color: #ff6b35;
  margin-bottom: 4px;
}

.stat-card .stat-label {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 400;
}

/* Распределение по местам */
.positions-breakdown {
  margin-bottom: 16px;
}

.position-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 8px;
}

.position-stat {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  padding: 10px;
  text-align: center;
  transition: background-color 0.2s ease;
}

.position-stat:hover {
  background: rgba(255, 255, 255, 0.08);
}

.position-stat.position-1 {
  border: 1px solid #ffd700;
}

.position-stat.position-2 {
  border: 1px solid #c0c0c0;
}

.position-stat.position-3 {
  border: 1px solid #cd7f32;
}

.position-stat.position-4,
.position-stat.position-5,
.position-stat.position-6 {
  border: 1px solid #6c757d;
}

.position-icon {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 6px;
  font-weight: 600;
  font-size: 1rem;
}

.position-1 .position-icon {
  background: #ffd700;
  color: #333;
}

.position-2 .position-icon {
  background: #c0c0c0;
  color: #333;
}

.position-3 .position-icon {
  background: #cd7f32;
  color: white;
}

.position-4 .position-icon,
.position-5 .position-icon,
.position-6 .position-icon {
  background: #6c757d;
  color: white;
}

.position-count {
  font-size: 1.2rem;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
}

.position-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 400;
}

/* Процентное соотношение */
.percentage-breakdown {
  margin-bottom: 12px;
}

.percentage-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.percentage-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}

.percentage-label {
  min-width: 60px;
  font-weight: 500;
  color: #fff;
  font-size: 0.8rem;
}

.progress-bar-container {
  flex: 1;
  height: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.3s ease;
}

.position-1-bg {
  background: #ffd700;
}

.position-2-bg {
  background: #c0c0c0;
}

.position-3-bg {
  background: #cd7f32;
}

.position-4-bg,
.position-5-bg,
.position-6-bg {
  background: #6c757d;
}

.percentage-value {
  min-width: 35px;
  text-align: right;
  font-weight: 500;
  color: #ff6b35;
  font-size: 0.8rem;
}

/* Responsive Design for Players Tab */
@media (max-width: 768px) {
  .global-player-card {
    padding: 15px;
  }

  .global-player-info {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .global-player-meta {
    flex-direction: column;
    gap: 8px;
  }

  .global-player-controls {
    justify-content: center;
  }

  .player-detailed-stats {
    padding: 15px;
    margin-top: 15px;
  }

  .player-detailed-stats h4 {
    font-size: 1.1rem;
    margin-bottom: 15px;
  }

  .player-detailed-stats h5 {
    font-size: 1rem;
    margin: 15px 0 10px 0;
  }

  .stats-row {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 10px;
    margin-bottom: 10px;
  }

  .stat-card {
    padding: 10px;
  }

  .stat-number {
    font-size: 1.4rem;
  }

  .stat-card .stat-label {
    font-size: 0.75rem;
  }

  .position-stats {
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
    gap: 8px;
  }

  .position-stat {
    padding: 10px;
  }

  .position-icon {
    width: 30px;
    height: 30px;
    font-size: 1rem;
    margin-bottom: 6px;
  }

  .position-count {
    font-size: 1.2rem;
  }

  .position-label {
    font-size: 0.7rem;
  }

  .percentage-bar {
    gap: 10px;
    padding: 6px 0;
  }

  .percentage-label {
    min-width: 60px;
    font-size: 0.8rem;
  }

  .progress-bar-container {
    height: 16px;
  }

  .percentage-value {
    min-width: 35px;
    font-size: 0.8rem;
  }
}
</style>
