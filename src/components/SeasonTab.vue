<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Season, Player, Match, DatabasePlayer } from '@/lib/supabase'

// Props
const props = defineProps<{
  seasons: Season[]
  globalPlayers: DatabasePlayer[]
  currentSeason: Season | null
  currentSeasonId: number | null
  isLoading: boolean
}>()

// Emits
const emit = defineEmits<{
  createSeason: [name: string, selectedPlayers: number[]]
  closeSeason: []
  switchToSeason: [seasonId: number]
  deleteSeason: [seasonId: number]
  addPlayerToSeason: [playerId: number]
  removePlayerFromSeason: [playerId: number]
  saveMatch: [matchPlayers: { playerId: number; winsInMatch: number; position: number; pointsEarned: number }[]]
  updatePlayerName: [playerId: number, name: string]
  updateSeasonName: [seasonId: number, name: string]
  updateMatch: [matchId: number, matchPlayers: { playerId: number; winsInMatch: number; position: number; pointsEarned: number }[]]
  deleteMatch: [matchId: number]
}>()

// Local reactive data
const newSeasonName = ref('')
const newPlayerName = ref('')
const currentMatch = ref<{ playerId: number; winsInMatch: number }[]>([])
const selectedPlayersForSeason = ref<number[]>([])

// Editing states
const editingPlayer = ref<{ id: number; name: string } | null>(null)
const editingSeason = ref<{ id: number; name: string } | null>(null)
const editingMatch = ref<{ id: number; players: { playerId: number; winsInMatch: number }[] } | null>(null)

// Computed properties
const players = computed(() => props.currentSeason?.players || [])
const matches = computed(() => props.currentSeason?.matches || [])

// Функция для расчета позиций на основе количества побед
const calculatePositionsFromWins = (players: { playerId: number; winsInMatch: number }[]) => {
  const sorted = [...players].sort((a, b) => b.winsInMatch - a.winsInMatch)

  let currentPosition = 1
  const result: { playerId: number; winsInMatch: number; position: number }[] = []

  for (let i = 0; i < sorted.length; i++) {
    const player = sorted[i]

    if (i > 0 && sorted[i - 1].winsInMatch === player.winsInMatch) {
      // Keep same position
    } else {
      currentPosition = i + 1
    }

    result.push({
      ...player,
      position: currentPosition,
    })
  }

  return result
}

// Points system with shared positions
const calculatePoints = (position: number, matchPlayers: { playerId: number; winsInMatch: number; position: number }[]): number => {
  const playersAtPosition = matchPlayers.filter(p => p.position === position).length

  if (position === 1) {
    if (playersAtPosition === 1) return 3
    if (playersAtPosition === 2) return 2.5
    return 2
  }

  if (position === 2) {
    if (playersAtPosition === 1) return 1
    if (playersAtPosition === 2) return 1.5
    return 0
  }

  return 0
}

// Computed leaderboard with proper tie handling
const leaderboard = computed(() => {
  const sortedPlayers = [...players.value]
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.wins !== a.wins) return b.wins - a.wins
      return a.name.localeCompare(b.name)
    })

  let currentRank = 1
  return sortedPlayers.map((player, index) => {
    if (index > 0) {
      const prevPlayer = sortedPlayers[index - 1]
      if (player.points !== prevPlayer.points || player.wins !== prevPlayer.wins) {
        currentRank = index + 1
      }
    }
    return { ...player, rank: currentRank }
  })
})

// Get player name by playerId
const getPlayerName = (playerId: number): string => {
  return players.value.find(p => p.playerId === playerId)?.name || 'Unknown'
}

// Check if player is in current match
const isPlayerInMatch = (playerId: number): boolean => {
  return currentMatch.value.some(m => m.playerId === playerId)
}

// Get player wins in current match
const getPlayerWinsInMatch = (playerId: number): number | null => {
  const match = currentMatch.value.find(m => m.playerId === playerId)
  return match ? match.winsInMatch : null
}

// Season management functions
const createNewSeason = () => {
  if (!newSeasonName.value.trim() || props.isLoading) return
  emit('createSeason', newSeasonName.value.trim(), selectedPlayersForSeason.value)
  newSeasonName.value = ''
  selectedPlayersForSeason.value = []
}

// Add player to current match with wins count
const addToCurrentMatch = (playerId: number, winsInMatch: number) => {
  currentMatch.value = currentMatch.value.filter(m => m.playerId !== playerId)
  currentMatch.value.push({ playerId, winsInMatch })
  currentMatch.value.sort((a, b) => b.winsInMatch - a.winsInMatch)
}

// Remove player from current match
const removeFromCurrentMatch = (playerId: number) => {
  currentMatch.value = currentMatch.value.filter(m => m.playerId !== playerId)
}

// Save current match
const saveMatch = () => {
  if (currentMatch.value.length === 0 || !props.currentSeason || props.isLoading) return

  const playersWithPositions = calculatePositionsFromWins(currentMatch.value)
  const matchPlayersWithPoints = playersWithPositions.map(mp => ({
    playerId: mp.playerId,
    winsInMatch: mp.winsInMatch,
    position: mp.position,
    pointsEarned: calculatePoints(mp.position, playersWithPositions)
  }))

  emit('saveMatch', matchPlayersWithPoints)
  currentMatch.value = []
}

// Editing functions
const startEditingPlayer = (player: Player) => {
  editingPlayer.value = { id: player.id, name: player.name }
}

const cancelEditingPlayer = () => {
  editingPlayer.value = null
}

const savePlayerEdit = () => {
  if (!editingPlayer.value || props.isLoading) return
  emit('updatePlayerName', editingPlayer.value.id, editingPlayer.value.name)
  editingPlayer.value = null
}

const startEditingSeason = (season: Season) => {
  editingSeason.value = { id: season.id, name: season.name }
}

const cancelEditingSeason = () => {
  editingSeason.value = null
}

const saveSeasonEdit = () => {
  if (!editingSeason.value || props.isLoading) return
  emit('updateSeasonName', editingSeason.value.id, editingSeason.value.name)
  editingSeason.value = null
}

const startEditingMatch = (match: Match) => {
  editingMatch.value = {
    id: match.id,
    players: match.players.map(p => ({
      playerId: p.playerId,
      winsInMatch: p.winsInMatch
    }))
  }
}

const cancelEditingMatch = () => {
  editingMatch.value = null
}

const saveMatchEdit = () => {
  if (!editingMatch.value || props.isLoading) return

  const playersWithPositions = calculatePositionsFromWins(editingMatch.value.players)
  const matchPlayersWithPoints = playersWithPositions.map(mp => ({
    playerId: mp.playerId,
    winsInMatch: mp.winsInMatch,
    position: mp.position,
    pointsEarned: calculatePoints(mp.position, playersWithPositions)
  }))

  emit('updateMatch', editingMatch.value.id, matchPlayersWithPoints)
  editingMatch.value = null
}

const updateEditingMatchPlayer = (playerId: number, winsInMatch: number) => {
  if (!editingMatch.value) return

  editingMatch.value.players = editingMatch.value.players.filter(m => m.playerId !== playerId)
  editingMatch.value.players.push({ playerId, winsInMatch })
  editingMatch.value.players.sort((a, b) => b.winsInMatch - a.winsInMatch)
}

const removeEditingMatchPlayer = (playerId: number) => {
  if (!editingMatch.value) return
  editingMatch.value.players = editingMatch.value.players.filter(m => m.playerId !== playerId)
}
</script>

<template>
  <div class="season-mode">
    <!-- Season Management Section -->
    <section class="section">
      <h2 class="section-title">Управление сезонами</h2>

      <!-- Current Season Info -->
      <div v-if="currentSeason" class="current-season">
        <div class="season-info">
          <h3>Текущий сезон: {{ currentSeason.name }}</h3>
          <p class="season-dates">
            Начат: {{ currentSeason.startDate }}
            <span v-if="currentSeason.endDate"> | Закончен: {{ currentSeason.endDate }}</span>
          </p>
        </div>
        <div class="season-actions">
          <button @click="emit('closeSeason')" class="btn btn-danger">
            <i class="fas fa-stop-circle"></i>
            Закрыть сезон
          </button>
        </div>
      </div>

      <!-- Create New Season -->
      <div class="create-season">
        <input v-model="newSeasonName" @keyup.enter="createNewSeason" placeholder="Название нового сезона..."
          class="input" :disabled="isLoading" />
        <button @click="createNewSeason" class="btn btn-primary" :disabled="isLoading">
          <span class="material-icons">add</span>
          {{ isLoading ? 'Загрузка...' : 'Создать сезон' }}
        </button>
      </div>

      <!-- Season Selector -->
      <div v-if="seasons.length > 0" class="season-selector">
        <h4>Все сезоны:</h4>
        <div class="seasons-list">
          <div v-for="season in seasons" :key="season.id" class="season-card"
            :class="{ active: season.id === currentSeasonId }">
            <div class="season-details">
              <div v-if="editingSeason?.id === season.id" class="season-edit">
                <input v-model="editingSeason.name" @keyup.enter="saveSeasonEdit" @keyup.esc="cancelEditingSeason"
                  class="input season-edit-input" />
                <div class="season-edit-controls">
                  <button @click="saveSeasonEdit" class="btn btn-primary btn-small">
                    <span class="material-icons">save</span> Сохранить
                  </button>
                  <button @click="cancelEditingSeason" class="btn btn-danger btn-small">
                    <span class="material-icons">close</span> Отмена
                  </button>
                </div>
              </div>
              <div v-else class="season-info">
                <div class="season-name" @dblclick="startEditingSeason(season)">{{ season.name }}</div>
                <div class="season-meta">
                  {{ season.players.length }} игроков | {{ season.matches.length }} матчей
                </div>
                <div class="season-dates-small">{{ season.startDate }}</div>
              </div>
            </div>
            <div class="season-controls">
              <button v-if="season.id !== currentSeasonId && !editingSeason" @click="emit('switchToSeason', season.id)"
                class="btn btn-primary btn-small">
                <span class="material-icons">play_arrow</span> Выбрать
              </button>
              <button v-if="!editingSeason" @click="startEditingSeason(season)" class="btn btn-secondary btn-small">
                <span class="material-icons">edit</span>
              </button>
              <button v-if="!editingSeason" @click="emit('deleteSeason', season.id)" class="btn btn-danger btn-small">
                <span class="material-icons">delete</span> Удалить
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- No Season Warning -->
      <div v-if="!currentSeason" class="no-season-warning">
        <p>Выберите существующий сезон или создайте новый для начала игры</p>
      </div>
    </section>

    <!-- Season Players Management Section -->
    <section class="section" v-if="currentSeason">
      <h2 class="section-title">Игроки текущего сезона</h2>

      <!-- Add existing players to season -->
      <div v-if="globalPlayers.length > 0" class="available-players">
        <h4>Добавить игроков в сезон:</h4>
        <div class="players-grid">
          <div v-for="player in globalPlayers.filter(p => !players.some(sp => sp.playerId === p.id))"
            :key="player.id" class="available-player-card">
            <span class="player-name">{{ player.name }}</span>
            <button @click="emit('addPlayerToSeason', player.id)" class="btn btn-secondary btn-small">
              <span class="material-icons">add</span>
              Добавить
            </button>
          </div>
        </div>
      </div>

      <div class="players-list" v-if="players.length > 0">
        <div v-for="player in players" :key="player.id" class="player-card">
          <div v-if="editingPlayer?.id === player.id" class="player-edit">
            <input v-model="editingPlayer.name" @keyup.enter="savePlayerEdit" @keyup.esc="cancelEditingPlayer"
              class="input player-edit-input" />
            <div class="player-edit-controls">
              <button @click="savePlayerEdit" class="btn btn-primary btn-small">
                <span class="material-icons">save</span> Сохранить
              </button>
              <button @click="cancelEditingPlayer" class="btn btn-danger btn-small">
                <span class="material-icons">close</span> Отмена
              </button>
            </div>
          </div>
          <div v-else class="player-info">
            <span class="player-name" @dblclick="startEditingPlayer(player)">{{ player.name }}</span>
            <span class="player-stats">
              {{ player.wins }} побед | {{ player.points }} очков
            </span>
            <div class="player-controls">
              <button @click="startEditingPlayer(player)" class="btn btn-secondary btn-small">
                <span class="material-icons">edit</span>
              </button>
              <button @click="emit('removePlayerFromSeason', player.playerId)" class="btn btn-danger btn-small">
                <span class="material-icons">delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Current Match Section -->
    <section class="section" v-if="currentSeason">
      <h2 class="section-title">Новый матч</h2>

      <div v-if="players.length === 0" class="empty-state">
        Сначала добавьте игроков
      </div>

      <div v-else>
        <div class="match-players">
          <div v-for="player in players" :key="player.id" class="match-player">
            <span class="player-name">{{ player.name }}</span>
            <div class="position-controls">
              <input type="number" min="0" max="100" placeholder="Количество побед"
                :value="getPlayerWinsInMatch(player.playerId) || ''"
                @input="addToCurrentMatch(player.playerId, parseInt(($event.target as HTMLInputElement).value) || 0)"
                class="wins-input" />
              <button v-if="isPlayerInMatch(player.playerId)" @click="removeFromCurrentMatch(player.playerId)"
                class="btn btn-danger btn-small">
                <span class="material-icons">remove</span> Убрать
              </button>
            </div>
          </div>
        </div>

        <div v-if="currentMatch.length > 0" class="current-match-preview">
          <h3>Результаты матча:</h3>
          <div v-for="match in calculatePositionsFromWins(currentMatch)" :key="match.playerId" class="match-result">
            <span class="wins">{{ match.winsInMatch }} побед</span>
            <span class="position">{{ match.position }} место</span>
            <span class="player-name">{{ getPlayerName(match.playerId) }}</span>
            <span class="points">+{{ calculatePoints(match.position, calculatePositionsFromWins(currentMatch)) }}
              очков</span>
          </div>
          <button @click="saveMatch" class="btn btn-success" :disabled="isLoading">
            <span class="material-icons">save</span>
            {{ isLoading ? 'Сохранение...' : 'Сохранить матч' }}
          </button>
        </div>
      </div>
    </section>

    <!-- Leaderboard Section -->
    <section class="section" v-if="currentSeason">
      <h2 class="section-title">Общий рейтинг</h2>

      <div v-if="leaderboard.length === 0" class="empty-state">
        Пока нет игроков
      </div>

      <div v-else class="leaderboard">
        <div v-for="player in leaderboard" :key="player.id" class="leaderboard-item" :class="`rank-${player.rank}`">
          <div class="rank">{{ player.rank }}</div>
          <div class="player-info">
            <div class="player-name">{{ player.name }}</div>
            <div class="player-details">
              {{ player.wins }} побед | {{ player.points }} очков
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Match History Section -->
    <section class="section" v-if="currentSeason && matches.length > 0">
      <h2 class="section-title">История матчей</h2>
      <div class="match-history-enhanced">
        <div v-for="(match, index) in matches.slice().reverse()" :key="match.id" class="match-card-history">
          <div class="match-header-history">
            <div class="match-info-header">
              <div class="match-date-header">
                <span class="material-icons">event</span>
                <span class="match-date">{{ match.date }}</span>
                <span class="match-number">#{{ matches.length - index }}</span>
              </div>
              <div class="match-stats-preview">
                <div class="stat-preview">
                  <span class="material-icons">group</span>
                  <span>{{ match.players.length }} игроков</span>
                </div>
                <div class="stat-preview">
                  <span class="material-icons">trending_up</span>
                  <span>{{match.players.reduce((sum, p) => sum + p.winsInMatch, 0)}} матчей</span>
                </div>
              </div>
            </div>
            <div class="match-controls">
              <button v-if="!editingMatch" @click="startEditingMatch(match)" class="btn btn-secondary btn-small">
                <span class="material-icons">edit</span>
                Редактировать
              </button>
              <button v-if="!editingMatch" @click="emit('deleteMatch', match.id)" class="btn btn-danger btn-small">
                <span class="material-icons">delete</span>
                Удалить
              </button>
            </div>
          </div>

          <!-- Enhanced Match Results Preview -->
          <div v-if="editingMatch?.id !== match.id" class="match-results-preview">
            <div class="winner-highlight">
              <div class="winner-info">
                <span class="material-icons">emoji_events</span>
                <span class="winner-label">{{match.players.filter(p => p.position === 1).length > 1 ? 'Победители:'
                  : 'Победитель:'}}</span>
                <div class="winners-list">
                  <span v-for="(winner, index) in match.players.filter(p => p.position === 1)"
                    :key="winner.playerId" class="winner-name">
                    {{ getPlayerName(winner.playerId) }}{{index < match.players.filter(p => p.position === 1).length
                      - 1 ? ', ' : ''}}
                  </span>
                </div>
                <span class="winner-performance">{{match.players.find(p => p.position === 1)?.winsInMatch}}
                  побед</span>
              </div>
              <div class="winner-points">+{{match.players.find(p => p.position === 1)?.pointsEarned}} очков</div>
            </div>

            <div class="match-positions-grid">
              <div v-for="result in match.players" :key="result.playerId" class="position-result">
                <div class="position-badge-small" :class="`position-${result.position}`">{{ result.position }}</div>
                <div class="player-result-info">
                  <span class="player-name">{{ getPlayerName(result.playerId) }}</span>
                  <div class="player-stats-inline">
                    <span class="wins-count">{{ result.winsInMatch }} побед</span>
                    <span class="points-earned">+{{ result.pointsEarned }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Detailed Match View -->
          <div v-if="editingMatch?.id === match.id" class="match-details">
            <div class="match-edit">
              <h4>Редактирование матча</h4>
              <div class="edit-match-players">
                <div v-for="player in players" :key="player.id" class="edit-match-player">
                  <span class="player-name">{{ player.name }}</span>
                  <div class="position-controls">
                    <input type="number" min="0" max="100" placeholder="Количество побед"
                      :value="editingMatch.players.find(p => p.playerId === player.playerId)?.winsInMatch || ''"
                      @input="updateEditingMatchPlayer(player.playerId, parseInt(($event.target as HTMLInputElement).value) || 0)"
                      class="wins-input" />
                    <button v-if="editingMatch.players.some(p => p.playerId === player.playerId)"
                      @click="removeEditingMatchPlayer(player.playerId)" class="btn btn-danger btn-small">
                      <span class="material-icons">remove</span> Убрать
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="editingMatch.players.length > 0" class="edit-match-preview">
                <h5>Предварительный результат:</h5>
                <div v-for="mp in calculatePositionsFromWins(editingMatch.players)" :key="mp.playerId"
                  class="match-result">
                  <span class="wins">{{ mp.winsInMatch }} побед</span>
                  <span class="position">{{ mp.position }} место</span>
                  <span class="player-name">{{ getPlayerName(mp.playerId) }}</span>
                  <span class="points">+{{ calculatePoints(mp.position,
                    calculatePositionsFromWins(editingMatch.players)) }} очков</span>
                </div>
              </div>

              <div class="match-edit-controls">
                <button @click="saveMatchEdit" class="btn btn-success" :disabled="isLoading">
                  <span class="material-icons">save</span>
                  {{ isLoading ? 'Сохранение...' : 'Сохранить изменения' }}
                </button>
                <button @click="cancelEditingMatch" class="btn btn-danger">
                  <span class="material-icons">close</span>
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
/* Season Mode Styles */
.season-mode {
  animation: fadeIn 0.3s ease-in;
}

/* Season Management Styles */
.current-season {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 107, 53, 0.1);
  border: 1px solid rgba(255, 107, 53, 0.3);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.season-info h3 {
  margin: 0 0 5px 0;
  color: #ff6b35;
}

.season-dates {
  margin: 0;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
}

.create-season {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.season-selector h4 {
  color: #ff6b35;
  margin: 0 0 15px 0;
}

.seasons-list {
  display: grid;
  gap: 10px;
}

.season-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 107, 53, 0.2);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.season-card.active {
  background: rgba(255, 107, 53, 0.15);
  border-color: #ff6b35;
  box-shadow: 0 0 10px rgba(255, 107, 53, 0.3);
}

.season-card:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: #ff6b35;
}

.season-name {
  font-weight: bold;
  font-size: 1.1rem;
  color: #ffffff;
}

.season-meta {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  margin: 5px 0;
}

.season-dates-small {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.8rem;
}

.season-controls {
  display: flex;
  gap: 10px;
}

.season-edit {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.season-edit-input {
  width: 100%;
}

.season-edit-controls {
  display: flex;
  gap: 8px;
}

.no-season-warning {
  text-align: center;
  padding: 30px;
  background: rgba(220, 53, 69, 0.1);
  border: 1px solid rgba(220, 53, 69, 0.3);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
}

/* Available Players Styles */
.available-players {
  margin: 24px 0;
  padding: 24px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 107, 53, 0.3);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.available-players h4 {
  margin: 0 0 20px 0;
  color: #ff6b35;
  font-weight: 600;
  font-size: 1.1rem;
}

.players-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.available-player-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  border: 1px solid rgba(255, 107, 53, 0.2);
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.available-player-card:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 107, 53, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.available-player-card .player-name {
  font-weight: 600;
  color: #fff;
  font-size: 1rem;
  flex: 1;
  margin-right: 12px;
}

/* Season Players List Styles */
.players-list {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.player-card {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 107, 53, 0.3);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.player-card:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 107, 53, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.player-edit {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.player-edit-input {
  flex: 1;
  min-width: 200px;
}

.player-edit-controls {
  display: flex;
  gap: 8px;
}

.player-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.player-info .player-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  transition: color 0.2s ease;
}

.player-info .player-name:hover {
  color: #ff6b35;
}

.player-stats {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  font-weight: 500;
}

.player-controls {
  display: flex;
  gap: 8px;
}

/* Match Management Styles */
.match-players {
  display: grid;
  gap: 15px;
  margin-bottom: 20px;
}

.match-player {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.position-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.wins-input {
  padding: 8px 12px;
  border: 1px solid rgba(255, 107, 53, 0.3);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  font-size: 14px;
  width: 120px;
  text-align: center;
}

.wins-input:focus {
  outline: none;
  border-color: #ff6b35;
  box-shadow: 0 0 5px rgba(255, 107, 53, 0.3);
}

.wins-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.current-match-preview {
  background: rgba(255, 107, 53, 0.1);
  border: 1px solid rgba(255, 107, 53, 0.3);
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
}

.current-match-preview h3 {
  margin: 0 0 15px 0;
  color: #ff6b35;
}

.match-result {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.match-result:last-child {
  border-bottom: none;
}

.wins {
  background: linear-gradient(45deg, #ff6b35, #f7931e);
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-weight: bold;
  font-size: 12px;
  min-width: 60px;
  text-align: center;
}

.position {
  font-weight: bold;
  color: #ff6b35;
  min-width: 70px;
}

.points {
  color: #28a745;
  font-weight: bold;
  margin-left: auto;
}

/* Leaderboard Styles */
.leaderboard {
  display: grid;
  gap: 12px;
}

.leaderboard-item {
  display: flex;
  align-items: center;
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid transparent;
  border-radius: 10px;
  transition: all 0.3s ease;
}

.leaderboard-item.rank-1 {
  background: linear-gradient(45deg, rgba(255, 215, 0, 0.2), rgba(255, 107, 53, 0.2));
  border-color: #ffd700;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
}

.leaderboard-item.rank-2 {
  background: linear-gradient(45deg, rgba(192, 192, 192, 0.2), rgba(255, 107, 53, 0.1));
  border-color: #c0c0c0;
}

.leaderboard-item.rank-3 {
  background: linear-gradient(45deg, rgba(205, 127, 50, 0.2), rgba(255, 107, 53, 0.1));
  border-color: #cd7f32;
}

.rank {
  font-size: 2rem;
  font-weight: 800;
  color: #ff6b35;
  min-width: 60px;
  text-align: center;
}

.rank-1 .rank {
  color: #ffd700;
}

.rank-2 .rank {
  color: #c0c0c0;
}

.rank-3 .rank {
  color: #cd7f32;
}

.player-info {
  flex: 1;
  margin-left: 20px;
}

.player-details {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  margin-top: 5px;
}

/* Enhanced Match History */
.match-history-enhanced {
  display: grid;
  gap: 20px;
}

.match-card-history {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 107, 53, 0.2);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
}

.match-header-history {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.match-info-header {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.match-date-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ff6b35;
  font-weight: 700;
  font-size: 1.1rem;
}

.match-date-header .material-icons {
  font-size: 20px;
}

.match-stats-preview {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.stat-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
}

.stat-preview .material-icons {
  font-size: 16px;
  color: #ff6b35;
}

.match-results-preview {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.winner-highlight {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: rgba(255, 215, 0, 0.1);
  border-radius: 10px;
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.winner-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.winner-info .material-icons {
  color: #ffd700;
  font-size: 24px;
}

.winner-label {
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

.winner-name {
  color: #ffd700;
  font-weight: 700;
  font-size: 1.2rem;
}

.winner-performance {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 8px;
  border-radius: 6px;
}

.winner-points {
  color: #28a745;
  font-weight: 700;
  font-size: 1.1rem;
}

.match-positions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.position-result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  transition: background 0.2s ease;
}

.position-result:hover {
  background: rgba(255, 255, 255, 0.06);
}

.position-badge-small {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.position-badge-small.position-1 {
  background: #ffd700;
  color: #333;
}

.position-badge-small.position-2 {
  background: #c0c0c0;
  color: #333;
}

.position-badge-small.position-3 {
  background: #cd7f32;
  color: white;
}

.position-badge-small.position-4,
.position-badge-small.position-5,
.position-badge-small.position-6 {
  background: #6c757d;
  color: white;
}

.player-result-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.player-result-info .player-name {
  font-weight: 600;
  color: #fff;
  font-size: 1rem;
}

.player-stats-inline {
  display: flex;
  gap: 12px;
}

.wins-count {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.points-earned {
  font-size: 0.8rem;
  color: #28a745;
  font-weight: 600;
}

/* Match Management Styles */
.match-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 107, 53, 0.2);
}

.match-controls {
  display: flex;
  gap: 8px;
}

.match-details {
  margin-top: 15px;
}

.match-edit {
  background: rgba(255, 107, 53, 0.1);
  border: 1px solid rgba(255, 107, 53, 0.3);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 15px;
}

.edit-match-players {
  display: grid;
  gap: 10px;
  margin: 15px 0;
}

.edit-match-player {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 5px;
}

.edit-match-preview {
  background: rgba(40, 167, 69, 0.1);
  border: 1px solid rgba(40, 167, 69, 0.3);
  border-radius: 8px;
  padding: 15px;
  margin: 15px 0;
}

.edit-match-preview h5 {
  margin: 0 0 10px 0;
  color: #28a745;
}

.match-edit-controls {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 20px;
}

.match-full-results {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 15px;
}

.match-result-detailed {
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.match-result-detailed:last-child {
  border-bottom: none;
}

.result-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.position-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  font-weight: bold;
  font-size: 14px;
}

.position-badge.position-1 {
  background: linear-gradient(45deg, #ffd700, #ffed4e);
  color: #333;
}

.position-badge.position-2 {
  background: linear-gradient(45deg, #c0c0c0, #e8e8e8);
  color: #333;
}

.position-badge.position-3 {
  background: linear-gradient(45deg, #cd7f32, #daa520);
  color: #fff;
}

.position-badge.position-4,
.position-badge.position-5,
.position-badge.position-6 {
  background: linear-gradient(45deg, #6c757d, #495057);
  color: #fff;
}

.points-earned {
  margin-left: auto;
  font-weight: bold;
  color: #28a745;
}

/* Responsive Design for Season Tab */
@media (max-width: 768px) {
  .current-season {
    flex-direction: column;
    gap: 15px;
    align-items: stretch;
  }

  .create-season {
    flex-direction: column;
  }

  .season-card {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }

  .season-controls {
    justify-content: center;
  }

  .players-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .available-players {
    margin: 20px 0;
    padding: 20px;
  }

  .available-player-card {
    padding: 14px;
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .available-player-card .player-name {
    margin-right: 0;
    margin-bottom: 8px;
    text-align: center;
  }

  .player-card {
    padding: 16px;
  }

  .player-edit {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .player-edit-input {
    min-width: auto;
  }

  .player-info {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .player-controls {
    justify-content: center;
  }

  .match-player {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }

  .position-controls {
    justify-content: center;
  }

  .match-header-history {
    flex-direction: column;
    gap: 15px;
    align-items: stretch;
  }

  .match-info-header {
    text-align: center;
  }

  .match-stats-preview {
    justify-content: center;
    gap: 15px;
  }

  .match-controls {
    justify-content: center;
    flex-wrap: wrap;
  }

  .winner-highlight {
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }

  .winner-info {
    justify-content: center;
    flex-wrap: wrap;
  }

  .match-positions-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .position-result {
    padding: 10px;
  }

  .player-stats-inline {
    gap: 8px;
  }
}
</style>
