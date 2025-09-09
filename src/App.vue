<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { scoreboardServiceV2 as scoreboardService } from '@/services/scoreboardServiceV2'
import type { Player, Match, Season, DatabasePlayer } from '@/lib/supabase'

// Reactive data
const seasons = ref<Season[]>([])
const globalPlayers = ref<DatabasePlayer[]>([])
const currentSeasonId = ref<number | null>(null)
const newPlayerName = ref('')
const newSeasonName = ref('')
const currentMatch = ref<{ playerId: number; position: number }[]>([])
const isLoading = ref(false)
const selectedPlayersForSeason = ref<number[]>([])

// Tab system
const activeTab = ref<'view' | 'season' | 'players'>('view')

// Editing states
const editingPlayer = ref<{ id: number; name: string } | null>(null)
const editingGlobalPlayer = ref<{ id: number; name: string } | null>(null)
const editingSeason = ref<{ id: number; name: string } | null>(null)
const editingMatch = ref<{ id: number; players: { playerId: number; position: number }[] } | null>(null)
const showMatchDetails = ref<{ [key: number]: boolean }>({})

// Computed current season
const currentSeason = computed(() => {
  return seasons.value.find(s => s.id === currentSeasonId.value) || null
})

// Computed players and matches for current season
const players = computed(() => currentSeason.value?.players || [])
const matches = computed(() => currentSeason.value?.matches || [])

// Points system with shared positions
const calculatePoints = (position: number, matchPlayers: { playerId: number; position: number }[]): number => {
  // Count how many players share the same position
  const playersAtPosition = matchPlayers.filter(p => p.position === position).length

  if (position === 1) {
    if (playersAtPosition === 1) return 3 // Single 1st place
    if (playersAtPosition === 2) return 2.5 // Two 1st places: (3+1)/2 = 2
    return 2 // Three or more 1st places: (3+1+0)/3 = 1.33, округляем до 2
  }

  if (position === 2) {
    if (playersAtPosition === 1) return 1 // Single 2nd place
    if (playersAtPosition === 2) return 1.5 // Two 2nd places get 1.5 each
    return 0 // Three or more 2nd places get 0
  }

  return 0 // 3rd place and below always get 0
}

// Season management
const createNewSeason = async () => {
  if (!newSeasonName.value.trim() || isLoading.value) return

  isLoading.value = true
  try {
    const newSeason = await scoreboardService.createSeason(
      newSeasonName.value.trim(),
      selectedPlayersForSeason.value
    )
    if (newSeason) {
      await loadSeasons()
      currentSeasonId.value = newSeason.id
      newSeasonName.value = ''
      selectedPlayersForSeason.value = []
    }
  } catch (error) {
    console.error('Error creating season:', error)
  } finally {
    isLoading.value = false
  }
}

const closeSeason = async () => {
  if (!currentSeason.value || isLoading.value) return

  if (confirm(`Вы уверены, что хотите закрыть сезон "${currentSeason.value.name}"?`)) {
    isLoading.value = true
    try {
      const success = await scoreboardService.closeSeason(currentSeason.value.id)
      if (success) {
        await loadSeasons()
        currentSeasonId.value = null
      }
    } catch (error) {
      console.error('Error closing season:', error)
    } finally {
      isLoading.value = false
    }
  }
}

const switchToSeason = (seasonId: number) => {
  currentSeasonId.value = seasonId
}

const deleteSeason = async (seasonId: number) => {
  const season = seasons.value.find(s => s.id === seasonId)
  if (!season || isLoading.value) return

  if (confirm(`Вы уверены, что хотите удалить сезон "${season.name}"? Это действие нельзя отменить.`)) {
    isLoading.value = true
    try {
      const success = await scoreboardService.deleteSeason(seasonId)
      if (success) {
        await loadSeasons()
        if (currentSeasonId.value === seasonId) {
          currentSeasonId.value = null
        }
      }
    } catch (error) {
      console.error('Error deleting season:', error)
    } finally {
      isLoading.value = false
    }
  }
}

// Add new player
// Global player management
const createGlobalPlayer = async () => {
  if (!newPlayerName.value.trim() || isLoading.value) return

  isLoading.value = true
  try {
    const newPlayer = await scoreboardService.createGlobalPlayer(newPlayerName.value.trim())
    if (newPlayer) {
      await loadGlobalPlayers()
      newPlayerName.value = ''
    }
  } catch (error) {
    console.error('Error creating global player:', error)
  } finally {
    isLoading.value = false
  }
}

// Global player editing functions
const startEditingGlobalPlayer = (player: DatabasePlayer) => {
  editingGlobalPlayer.value = { id: player.id, name: player.name }
}

const cancelEditingGlobalPlayer = () => {
  editingGlobalPlayer.value = null
}

const saveGlobalPlayerEdit = async () => {
  if (!editingGlobalPlayer.value || isLoading.value) return

  isLoading.value = true
  try {
    const success = await scoreboardService.updateGlobalPlayerName(
      editingGlobalPlayer.value.id,
      editingGlobalPlayer.value.name
    )
    if (success) {
      await loadGlobalPlayers()
      await loadSeasons() // Reload to update player names in seasons
      editingGlobalPlayer.value = null
    }
  } catch (error) {
    console.error('Error updating global player name:', error)
  } finally {
    isLoading.value = false
  }
}

const deleteGlobalPlayerConfirm = async (playerId: number) => {
  const player = globalPlayers.value.find(p => p.id === playerId)
  if (!player) return

  const participatingSeasons = getSeasonsForPlayer(playerId)
  let confirmMessage = `Вы уверены, что хотите удалить игрока "${player.name}"?`

  if (participatingSeasons.length > 0) {
    confirmMessage += `\n\nВнимание: Игрок участвует в ${participatingSeasons.length} сезонах. Вся его статистика будет удалена!`
  }

  if (confirm(confirmMessage)) {
    isLoading.value = true
    try {
      const success = await scoreboardService.deleteGlobalPlayer(playerId)
      if (success) {
        await loadGlobalPlayers()
        await loadSeasons()
      }
    } catch (error) {
      console.error('Error deleting global player:', error)
    } finally {
      isLoading.value = false
    }
  }
}

// Helper functions for global players
const getSeasonsForPlayer = (playerId: number) => {
  return seasons.value.filter(season =>
    season.players.some(p => p.playerId === playerId)
  )
}

const getTotalWinsForPlayer = (playerId: number) => {
  return seasons.value.reduce((total, season) => {
    const player = season.players.find(p => p.playerId === playerId)
    return total + (player?.wins || 0)
  }, 0)
}

const getSeasonWinsForPlayer = (playerId: number) => {
  return seasons.value.reduce((total, season) => {
    if (season.players.length === 0) return total
    
    // Определяем победителей сезона (игроки с наибольшим количеством очков)
    const maxPoints = Math.max(...season.players.map(p => p.points))
    const seasonWinners = season.players
      .filter(p => p.points === maxPoints)
      .map(p => p.playerId)
    
    return total + (seasonWinners.includes(playerId) ? 1 : 0)
  }, 0)
}

// Get current season winners (can be multiple if tied)
const getCurrentSeasonWinners = () => {
  if (!currentSeason.value || currentSeason.value.players.length === 0) return []
  
  const maxPoints = Math.max(...currentSeason.value.players.map(p => p.points))
  return currentSeason.value.players.filter(p => p.points === maxPoints)
}

// Check if player is current season winner
const isCurrentSeasonWinner = (playerId: number) => {
  const winners = getCurrentSeasonWinners()
  return winners.some(w => w.playerId === playerId)
}

// Season player management
const addPlayerToSeason = async (playerId: number) => {
  if (!currentSeason.value || isLoading.value) return

  isLoading.value = true
  try {
    const newPlayer = await scoreboardService.addPlayerToSeason(currentSeason.value.id, playerId)
    if (newPlayer) {
      await loadSeasons()
    }
  } catch (error) {
    console.error('Error adding player to season:', error)
  } finally {
    isLoading.value = false
  }
}

// Remove player from season
const removePlayerFromSeason = async (playerId: number) => {
  if (!currentSeason.value || isLoading.value) return

  isLoading.value = true
  try {
    const success = await scoreboardService.removePlayerFromSeason(currentSeason.value.id, playerId)
    if (success) {
      await loadSeasons()
      // Remove from current match if present
      currentMatch.value = currentMatch.value.filter(m => m.playerId !== playerId)
    }
  } catch (error) {
    console.error('Error removing player from season:', error)
  } finally {
    isLoading.value = false
  }
}

// Add player to current match
const addToCurrentMatch = (playerId: number, position: number) => {
  // Remove if already in match
  currentMatch.value = currentMatch.value.filter(m => m.playerId !== playerId)
  // Add with new position
  currentMatch.value.push({ playerId, position })
  // Sort by position
  currentMatch.value.sort((a, b) => a.position - b.position)
}

// Remove player from current match
const removeFromCurrentMatch = (playerId: number) => {
  currentMatch.value = currentMatch.value.filter(m => m.playerId !== playerId)
}

// Save current match
const saveMatch = async () => {
  if (currentMatch.value.length === 0 || !currentSeason.value || isLoading.value) return

  isLoading.value = true
  try {
    // Add pointsEarned to match players
    const matchPlayersWithPoints = currentMatch.value.map(mp => ({
      playerId: mp.playerId,
      position: mp.position,
      pointsEarned: calculatePoints(mp.position, currentMatch.value)
    }))

    const savedMatch = await scoreboardService.saveMatch(currentSeason.value.id, matchPlayersWithPoints)
    if (savedMatch) {
      await loadSeasons()
      // Clear current match
      currentMatch.value = []
    }
  } catch (error) {
    console.error('Error saving match:', error)
  } finally {
    isLoading.value = false
  }
}

// Clear all data
const clearAllData = async () => {
  if (confirm('Вы уверены, что хотите очистить все данные? Все сезоны будут удалены!')) {
    isLoading.value = true
    try {
      const success = await scoreboardService.clearAllData()
      if (success) {
        seasons.value = []
        currentSeasonId.value = null
        currentMatch.value = []
      }
    } catch (error) {
      console.error('Error clearing data:', error)
    } finally {
      isLoading.value = false
    }
  }
}

// Computed leaderboard
const leaderboard = computed(() => {
  return [...players.value]
    .sort((a, b) => {
      // First by points (descending)
      if (b.points !== a.points) return b.points - a.points
      // Then by wins (descending)
      if (b.wins !== a.wins) return b.wins - a.wins
      // Then by name (ascending)
      return a.name.localeCompare(b.name)
    })
    .map((player, index) => ({ ...player, rank: index + 1 }))
})

// Computed wins ranking (sorted by wins only) - current season
const winsRanking = computed(() => {
  return [...players.value]
    .sort((a, b) => {
      // Sort by wins (descending)
      if (b.wins !== a.wins) return b.wins - a.wins
      // Then by name (ascending)
      return a.name.localeCompare(b.name)
    })
})

// Computed global wins ranking (all seasons combined)
const globalWinsRanking = computed(() => {
  const playerStatsMap = new Map<number, { 
    name: string; 
    totalMatchWins: number; 
    seasonWins: number;
    seasonsParticipated: number;
  }>()

  // Собираем статистику из всех сезонов для каждого глобального игрока
  seasons.value.forEach(season => {
    // Определяем победителей сезона (игроки с наибольшим количеством очков)
    let seasonWinners: number[] = []
    if (season.players.length > 0) {
      const maxPoints = Math.max(...season.players.map(p => p.points))
      seasonWinners = season.players
        .filter(p => p.points === maxPoints)
        .map(p => p.playerId)
    }

    season.players.forEach(player => {
      const existing = playerStatsMap.get(player.playerId)
      const isSeasonWinner = seasonWinners.includes(player.playerId)
      
      if (existing) {
        existing.totalMatchWins += player.wins
        if (isSeasonWinner) existing.seasonWins += 1
        existing.seasonsParticipated += 1
      } else {
        playerStatsMap.set(player.playerId, {
          name: player.name,
          totalMatchWins: player.wins,
          seasonWins: isSeasonWinner ? 1 : 0,
          seasonsParticipated: 1
        })
      }
    })
  })

  // Конвертируем в массив и сортируем
  return Array.from(playerStatsMap.entries())
    .map(([playerId, data]) => ({
      playerId,
      name: data.name,
      totalMatchWins: data.totalMatchWins,
      seasonWins: data.seasonWins,
      seasonsParticipated: data.seasonsParticipated
    }))
    .sort((a, b) => {
      // Sort by season wins first (descending)
      if (b.seasonWins !== a.seasonWins) return b.seasonWins - a.seasonWins
      // Then by total match wins (descending)
      if (b.totalMatchWins !== a.totalMatchWins) return b.totalMatchWins - a.totalMatchWins
      // Then by name (ascending)
      return a.name.localeCompare(b.name)
    })
})

// Get player name by playerId (global player ID)
const getPlayerName = (playerId: number): string => {
  return players.value.find(p => p.playerId === playerId)?.name || 'Unknown'
}

// Check if player is in current match
const isPlayerInMatch = (playerId: number): boolean => {
  return currentMatch.value.some(m => m.playerId === playerId)
}

// Get player position in current match
const getPlayerPosition = (playerId: number): number | null => {
  const match = currentMatch.value.find(m => m.playerId === playerId)
  return match ? match.position : null
}

// Load data from Supabase
const loadSeasons = async () => {
  isLoading.value = true
  try {
    const loadedSeasons = await scoreboardService.getAllSeasons()
    seasons.value = loadedSeasons

    // Если есть активный сезон, выбираем его
    const activeSeason = loadedSeasons.find(s => s.isActive)
    if (activeSeason) {
      currentSeasonId.value = activeSeason.id
    } else if (loadedSeasons.length > 0) {
      // Если активного нет, выбираем последний
      currentSeasonId.value = loadedSeasons[0].id
    }
  } catch (error) {
    console.error('Error loading seasons:', error)
  } finally {
    isLoading.value = false
  }
}

const loadGlobalPlayers = async () => {
  try {
    globalPlayers.value = await scoreboardService.getAllGlobalPlayers()
  } catch (error) {
    console.error('Error fetching global players:', error)
  }
}

// Editing functions
const startEditingPlayer = (player: Player) => {
  editingPlayer.value = { id: player.id, name: player.name }
}

const cancelEditingPlayer = () => {
  editingPlayer.value = null
}

const savePlayerEdit = async () => {
  if (!editingPlayer.value || isLoading.value) return

  isLoading.value = true
  try {
    const success = await scoreboardService.updatePlayerName(editingPlayer.value.id, editingPlayer.value.name)
    if (success) {
      await loadSeasons()
      editingPlayer.value = null
    }
  } catch (error) {
    console.error('Error updating player:', error)
  } finally {
    isLoading.value = false
  }
}

const startEditingSeason = (season: Season) => {
  editingSeason.value = { id: season.id, name: season.name }
}

const cancelEditingSeason = () => {
  editingSeason.value = null
}

const saveSeasonEdit = async () => {
  if (!editingSeason.value || isLoading.value) return

  isLoading.value = true
  try {
    const success = await scoreboardService.updateSeasonName(editingSeason.value.id, editingSeason.value.name)
    if (success) {
      await loadSeasons()
      editingSeason.value = null
    }
  } catch (error) {
    console.error('Error updating season:', error)
  } finally {
    isLoading.value = false
  }
}

const startEditingMatch = (match: Match) => {
  editingMatch.value = { id: match.id, players: [...match.players] }
}

const cancelEditingMatch = () => {
  editingMatch.value = null
}

const saveMatchEdit = async () => {
  if (!editingMatch.value || isLoading.value) return

  isLoading.value = true
  try {
    // Add pointsEarned to match players
    const matchPlayersWithPoints = editingMatch.value.players.map(mp => ({
      playerId: mp.playerId,
      position: mp.position,
      pointsEarned: calculatePoints(mp.position, editingMatch.value!.players)
    }))

    const success = await scoreboardService.updateMatch(editingMatch.value.id, matchPlayersWithPoints)
    if (success) {
      await loadSeasons()
      editingMatch.value = null
    }
  } catch (error) {
    console.error('Error updating match:', error)
  } finally {
    isLoading.value = false
  }
}

const deleteMatch = async (matchId: number) => {
  if (isLoading.value) return

  if (confirm('Вы уверены, что хотите удалить этот матч? Статистика игроков будет пересчитана.')) {
    isLoading.value = true
    try {
      const success = await scoreboardService.deleteMatch(matchId)
      if (success) {
        await loadSeasons()
      }
    } catch (error) {
      console.error('Error deleting match:', error)
    } finally {
      isLoading.value = false
    }
  }
}

const toggleMatchDetails = (matchId: number) => {
  showMatchDetails.value[matchId] = !showMatchDetails.value[matchId]
}

const updateEditingMatchPlayer = (playerId: number, position: number) => {
  if (!editingMatch.value) return

  // Remove if already in match
  editingMatch.value.players = editingMatch.value.players.filter(m => m.playerId !== playerId)
  // Add with new position
  editingMatch.value.players.push({ playerId, position })
  // Sort by position
  editingMatch.value.players.sort((a, b) => a.position - b.position)
}

const removeEditingMatchPlayer = (playerId: number) => {
  if (!editingMatch.value) return
  editingMatch.value.players = editingMatch.value.players.filter(m => m.playerId !== playerId)
}

// Tab functions
const switchTab = (tab: 'view' | 'season' | 'players') => {
  activeTab.value = tab
  // Cancel any ongoing edits when switching tabs
  if (tab === 'view') {
    editingPlayer.value = null
    editingGlobalPlayer.value = null
    editingSeason.value = null
    editingMatch.value = null
  }
}

// Enhanced leaderboard functions
const getRankClass = (rank: number) => {
  if (rank === 1) return 'gold'
  if (rank === 2) return 'silver'
  if (rank === 3) return 'bronze'
  return 'default'
}

const getRankIcon = (rank: number) => {
  if (rank === 1) return 'emoji_events'
  if (rank === 2) return 'workspace_premium'
  if (rank === 3) return 'workspace_premium'
  return 'person'
}

const getProgressPercentage = (points: number) => {
  if (leaderboard.value.length === 0) return 0
  const maxPoints = Math.max(...leaderboard.value.map(p => p.points), 1)
  return Math.min((points / maxPoints) * 100, 100)
}

// Load data on mount
onMounted(() => {
  loadSeasons()
  loadGlobalPlayers()
})
</script>

<template>
  <div class="app">
    <header class="header">
      <h1 class="title">
        <span class="title-main">COD BO6</span>
        <span class="title-sub">BABYLON</span>
      </h1>

      <!-- Tab Navigation -->
      <div class="tab-navigation">
        <button @click="switchTab('view')" class="tab-btn" :class="{ active: activeTab === 'view' }">
          <span class="material-icons">visibility</span>
          Просмотр
        </button>
        <button @click="switchTab('season')" class="tab-btn" :class="{ active: activeTab === 'season' }">
          <span class="material-icons">sports</span>
          Сезон
        </button>
        <button @click="switchTab('players')" class="tab-btn" :class="{ active: activeTab === 'players' }">
          <span class="material-icons">group</span>
          Игроки
        </button>
      </div>
    </header>

    <div class="container">
      <!-- VIEW MODE -->
      <div v-if="activeTab === 'view'" class="view-mode">
        <!-- Current Season Info -->
        <section class="section" v-if="currentSeason">
          <h2 class="section-title">{{ currentSeason.name }}</h2>
          <div class="season-info-display">
            <div class="season-stats">
              <div class="stat-item">
                <span class="stat-label">Игроков:</span>
                <span class="stat-value">{{ currentSeason.players.length }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Матчей:</span>
                <span class="stat-value">{{ currentSeason.matches.length }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Начат:</span>
                <span class="stat-value">{{ currentSeason.startDate }}</span>
              </div>
              <div v-if="currentSeason.endDate" class="stat-item">
                <span class="stat-label">Закончен:</span>
                <span class="stat-value">{{ currentSeason.endDate }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Main Content with Sidebar -->
        <div class="main-layout" v-if="currentSeason">
          <!-- Main Content Area -->
          <div class="main-content">

            <!-- Leaderboard Section -->
            <section class="section" v-if="currentSeason">
              <h2 class="section-title"><span class="material-icons">emoji_events</span> Рейтинг лидеров</h2>

              <div v-if="leaderboard.length === 0" class="empty-state">
                Пока нет игроков
              </div>

              <div v-else class="leaderboard-enhanced">
                <!-- Top 3 Podium -->
                <div class="podium" v-if="leaderboard.length >= 3">
                  <div class="podium-positions">
                    <!-- 2nd Place -->
                    <div class="podium-item podium-second" v-if="leaderboard[1]">
                      <div class="podium-player">
                        <div class="podium-avatar">
                          <span class="material-icons">person</span>
                        </div>
                        <div class="podium-medal silver">
                          <span class="material-icons">workspace_premium</span>
                          <span class="medal-number">2</span>
                        </div>
                        <div class="podium-name">{{ leaderboard[1].name }}</div>
                        <div class="podium-stats">
                          <div class="stat">{{ leaderboard[1].points }} очков</div>
                          <div class="stat">{{ leaderboard[1].wins }} побед</div>
                        </div>
                      </div>
                      <div class="podium-base podium-base-2"></div>
                    </div>

                    <!-- 1st Place -->
                    <div class="podium-item podium-first" v-if="leaderboard[0]">
                      <div class="podium-player">
                        <div class="podium-avatar champion">
                          <span class="material-icons">person</span>
                        </div>
                        <div class="podium-medal gold">
                          <span class="material-icons">emoji_events</span>
                          <span class="medal-number">1</span>
                        </div>
                        <div class="podium-name champion-name">{{ leaderboard[0].name }}</div>
                        <div class="podium-stats">
                          <div class="stat">{{ leaderboard[0].points }} очков</div>
                          <div class="stat">{{ leaderboard[0].wins }} побед</div>
                        </div>
                      </div>
                      <div class="podium-base podium-base-1"></div>
                    </div>

                    <!-- 3rd Place -->
                    <div class="podium-item podium-third" v-if="leaderboard[2]">
                      <div class="podium-player">
                        <div class="podium-avatar">
                          <span class="material-icons">person</span>
                        </div>
                        <div class="podium-medal bronze">
                          <span class="material-icons">workspace_premium</span>
                          <span class="medal-number">3</span>
                        </div>
                        <div class="podium-name">{{ leaderboard[2].name }}</div>
                        <div class="podium-stats">
                          <div class="stat">{{ leaderboard[2].points }} очков</div>
                          <div class="stat">{{ leaderboard[2].wins }} побед</div>
                        </div>
                      </div>
                      <div class="podium-base podium-base-3"></div>
                    </div>
                  </div>
                </div>

                <!-- Detailed Leaderboard -->
                <div class="leaderboard-list">
                  <div v-for="(player, index) in leaderboard" :key="player.id" class="leaderboard-item-enhanced"
                    :class="{ 'top-three': index < 3 }">

                    <div class="player-rank">
                      <div class="rank-circle" :class="getRankClass(index + 1)">
                        <span v-if="index < 3" class="material-icons">{{ getRankIcon(index + 1) }}</span>
                        <span v-else class="rank-number">{{ index + 1 }}</span>
                      </div>
                    </div>

                    <div class="player-avatar-small">
                      <span class="material-icons">person</span>
                    </div>

                    <div class="player-details-enhanced">
                      <div class="player-name-enhanced">{{ player.name }}</div>
                      <div class="player-progress">
                        <div class="progress-bar">
                          <div class="progress-fill" :style="{ width: `${getProgressPercentage(player.points)}%` }">
                          </div>
                        </div>
                        <div class="progress-text">{{ player.points }} очков</div>
                      </div>
                    </div>

                    <div class="player-stats-enhanced">
                      <div class="stat-item">
                        <span class="material-icons">military_tech</span>
                        <span class="stat-value">{{ player.wins }}</span>
                      </div>
                      <div class="stat-item">
                        <span class="material-icons">stars</span>
                        <span class="stat-value">{{ player.points }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <!-- Recent Matches -->
            <section class="section" v-if="currentSeason && matches.length > 0">
              <h2 class="section-title"><span class="material-icons">bar_chart</span> Последние матчи</h2>
              <div class="recent-matches">
                <div v-for="match in matches.slice().reverse().slice(0, 5)" :key="match.id" class="match-card-simple">
                  <div class="match-date">{{ match.date }}</div>
                  <div class="match-results-simple">
                    <div v-for="result in match.players" :key="result.playerId" class="match-result-simple">
                      <span class="position-simple">{{ result.position }}</span>
                      <span class="player-name">{{ getPlayerName(result.playerId) }}</span>
                      <span class="points">+{{ calculatePoints(result.position, match.players) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <!-- Sidebar - Global Wins Ranking -->
          <div class="sidebar">
            <div class="sidebar-section">
              <h3 class="sidebar-title">
                <span class="material-icons">emoji_events</span>
                Глобальный рейтинг
              </h3>
              <div class="subtitle">Выигранные сезоны и общие победы в матчах<br><small>При равных очках в сезоне все лидеры считаются победителями</small></div>
              <div class="wins-ranking">
                <div v-for="(player, index) in globalWinsRanking" :key="player.playerId" class="wins-ranking-item">
                  <div class="wins-rank" :class="{ 
                    'rank-champion': globalWinsRanking.length > 0 && player.seasonWins === globalWinsRanking[0].seasonWins && player.seasonWins > 0 
                  }">{{ index + 1 }}</div>
                  <div class="wins-player">
                    <div class="wins-player-name">{{ player.name }}</div>
                    <div class="wins-stats">
                      <div class="wins-count">
                        <span class="material-icons">emoji_events</span>
                        {{ player.seasonWins }} сезонов
                      </div>
                      <div class="wins-count">
                        <span class="material-icons">military_tech</span>
                        {{ player.totalMatchWins }} побед
                      </div>
                    </div>
                  </div>
                  <div v-if="globalWinsRanking.length > 0 && player.seasonWins === globalWinsRanking[0].seasonWins && player.seasonWins > 0" class="champion-badge">
                    <span class="material-icons">star</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- No Season Warning -->
        <section class="section" v-if="!currentSeason">
          <div class="no-season-warning">
            <h2>Добро пожаловать в COD BO6 Scoreboard!</h2>
            <p>Перейдите в режим редактирования, чтобы создать первый сезон и начать игру.</p>
            <button @click="switchTab('season')" class="btn btn-primary">
              <span class="material-icons">sports</span>
              Перейти к управлению сезонами
            </button>
          </div>
        </section>
      </div>

      <!-- SEASON MANAGEMENT MODE -->
      <div v-else-if="activeTab === 'season'" class="season-mode">
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
              <button @click="closeSeason" class="btn btn-danger">
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
                  <button v-if="season.id !== currentSeasonId && !editingSeason" @click="switchToSeason(season.id)"
                    class="btn btn-primary btn-small">
                    <span class="material-icons">play_arrow</span> Выбрать
                  </button>
                  <button v-if="!editingSeason" @click="startEditingSeason(season)" class="btn btn-secondary btn-small">
                    <span class="material-icons">edit</span>
                  </button>
                  <button v-if="!editingSeason" @click="deleteSeason(season.id)" class="btn btn-danger btn-small">
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
                <button @click="addPlayerToSeason(player.id)" class="btn btn-secondary btn-small">
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
                  <button @click="removePlayerFromSeason(player.playerId)" class="btn btn-danger btn-small">
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
                  <select @change="addToCurrentMatch(player.playerId, parseInt(($event.target as HTMLSelectElement).value))"
                    :value="getPlayerPosition(player.playerId) || ''" class="position-select">
                    <option value="">Выберите место</option>
                    <option value="1">1 место (3 очка, при делении 2.5)</option>
                    <option value="2">2 место (1 очко, при делении 1.5)</option>
                    <option value="3">3 место (0 очков)</option>
                    <option value="4">4 место (0 очков)</option>
                    <option value="5">5 место (0 очков)</option>
                    <option value="6">6 место (0 очков)</option>
                  </select>
                  <button v-if="isPlayerInMatch(player.playerId)" @click="removeFromCurrentMatch(player.playerId)"
                    class="btn btn-danger btn-small">
                    <span class="material-icons">remove</span> Убрать
                  </button>
                </div>
              </div>
            </div>

            <div v-if="currentMatch.length > 0" class="current-match-preview">
              <h3>Результаты матча:</h3>
              <div v-for="match in currentMatch" :key="match.playerId" class="match-result">
                <span class="position">{{ match.position }} место</span>
                <span class="player-name">{{ getPlayerName(match.playerId) }}</span>
                <span class="points">+{{ calculatePoints(match.position, currentMatch) }} очков</span>
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
          <div class="match-history">
            <div v-for="match in matches.slice().reverse()" :key="match.id" class="match-card">
              <div class="match-header">
                <div class="match-date">{{ match.date }}</div>
                <div class="match-controls">
                  <button @click="toggleMatchDetails(match.id)" class="btn btn-secondary btn-small">
                    <span class="material-icons">{{ showMatchDetails[match.id] ? 'expand_less' : 'expand_more' }}</span>
                    Детали
                  </button>
                  <button v-if="!editingMatch" @click="startEditingMatch(match)" class="btn btn-secondary btn-small">
                    <span class="material-icons">edit</span> Редактировать
                  </button>
                  <button v-if="!editingMatch" @click="deleteMatch(match.id)" class="btn btn-danger btn-small">
                    <span class="material-icons">delete</span> Удалить
                  </button>
                </div>
              </div>

              <!-- Basic Match Results -->
              <div v-if="!showMatchDetails[match.id]" class="match-results">
                <div v-for="result in match.players" :key="result.playerId" class="match-result">
                  <span class="position">{{ result.position }} место</span>
                  <span class="player-name">{{ getPlayerName(result.playerId) }}</span>
                  <span class="points">+{{ calculatePoints(result.position, match.players) }}</span>
                </div>
              </div>

              <!-- Detailed Match View -->
              <div v-if="showMatchDetails[match.id]" class="match-details">
                <div v-if="editingMatch?.id === match.id" class="match-edit">
                  <h4>Редактирование матча</h4>
                  <div class="edit-match-players">
                    <div v-for="player in players" :key="player.id" class="edit-match-player">
                      <span class="player-name">{{ player.name }}</span>
                      <div class="position-controls">
                        <select
                          @change="updateEditingMatchPlayer(player.playerId, parseInt(($event.target as HTMLSelectElement).value))"
                          :value="editingMatch.players.find(p => p.playerId === player.playerId)?.position || ''"
                          class="position-select">
                          <option value="">Не участвует</option>
                          <option value="1">1 место</option>
                          <option value="2">2 место</option>
                          <option value="3">3 место</option>
                          <option value="4">4 место</option>
                          <option value="5">5 место</option>
                          <option value="6">6 место</option>
                        </select>
                        <button v-if="editingMatch.players.some(p => p.playerId === player.playerId)"
                          @click="removeEditingMatchPlayer(player.playerId)" class="btn btn-danger btn-small">
                          <span class="material-icons">remove</span> Убрать
                        </button>
                      </div>
                    </div>
                  </div>

                  <div v-if="editingMatch.players.length > 0" class="edit-match-preview">
                    <h5>Предварительный результат:</h5>
                    <div v-for="mp in editingMatch.players" :key="mp.playerId" class="match-result">
                      <span class="position">{{ mp.position }} место</span>
                      <span class="player-name">{{ getPlayerName(mp.playerId) }}</span>
                      <span class="points">+{{ calculatePoints(mp.position, editingMatch.players) }} очков</span>
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

                <div v-else class="match-full-results">
                  <div v-for="result in match.players" :key="result.playerId" class="match-result-detailed">
                    <div class="result-info">
                      <span class="position-badge position-{{ result.position }}">{{ result.position }}</span>
                      <span class="player-name">{{ getPlayerName(result.playerId) }}</span>
                      <span class="points-earned">+{{ calculatePoints(result.position, match.players) }} очков</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Controls Section -->
        <section class="section">
          <div class="controls">
            <button @click="clearAllData" class="btn btn-danger">
              <span class="material-icons">delete</span>
              Очистить все данные
            </button>
          </div>
        </section>
      </div>

      <!-- PLAYERS MANAGEMENT MODE -->
      <div v-else-if="activeTab === 'players'" class="players-mode">
        <!-- Global Players Management Section -->
        <section class="section">
          <h2 class="section-title">Управление игроками</h2>

          <!-- Create New Player -->
          <div class="add-player">
            <input v-model="newPlayerName" @keyup.enter="createGlobalPlayer" placeholder="Введите имя нового игрока..."
              class="input" :disabled="isLoading" />
            <button @click="createGlobalPlayer" class="btn btn-primary" :disabled="isLoading">
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
                        {{ getSeasonWinsForPlayer(player.id) }} сезонов
                      </span>
                      <span class="total-wins">
                        <span class="material-icons">military_tech</span>
                        {{ getTotalWinsForPlayer(player.id) }} побед
                      </span>
                    </div>
                  </div>
                  <div class="global-player-controls">
                    <button @click="startEditingGlobalPlayer(player)" class="btn btn-secondary btn-small">
                      <span class="material-icons">edit</span>
                    </button>
                    <button @click="deleteGlobalPlayerConfirm(player.id)" class="btn btn-danger btn-small">
                      <span class="material-icons">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  color: #ffffff;
  font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  overflow-x: hidden;
  width: 100%;
  max-width: 100%;
}

.header {
  background: linear-gradient(90deg, #ff6b35 0%, #f7931e 100%);
  padding: 20px 0 10px 0;
  text-align: center;
  box-shadow: 0 4px 15px rgba(255, 107, 53, 0.3);
  width: 100%;
  overflow-x: hidden;
}

.title {
  margin: 0;
  font-weight: 800;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

.title-main {
  display: block;
  font-size: 2.5rem;
  letter-spacing: 3px;
}

.title-sub {
  display: block;
  font-size: 1.2rem;
  letter-spacing: 8px;
  margin-top: 5px;
  opacity: 0.9;
}

/* Tab Navigation */
.tab-navigation {
  display: flex;
  justify-content: center;
  gap: 0;
  margin-top: 20px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  padding: 6px;
  width: fit-content;
  max-width: 100%;
  margin-left: auto;
  margin-right: auto;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.tab-btn {
  padding: 14px 24px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.3s ease;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;
  min-width: 120px;
  flex: 1;
}

.tab-btn:hover {
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.tab-btn.active {
  background: linear-gradient(45deg, #ff6b35, #f7931e);
  color: #ffffff;
  box-shadow: 0 4px 15px rgba(255, 107, 53, 0.3);
  transform: translateY(-2px);
}

.tab-btn.active:hover {
  background: linear-gradient(45deg, #ff6b35, #f7931e);
  transform: translateY(-2px);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
}

.section {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 107, 53, 0.2);
  border-radius: 10px;
  padding: 25px;
  margin-bottom: 25px;
  backdrop-filter: blur(10px);
}

.section-title {
  color: #ff6b35;
  margin: 0 0 20px 0;
  font-size: 1.5rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: 10px;
}


.add-player {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.input {
  flex: 1;
  padding: 12px 15px;
  border: 2px solid rgba(255, 107, 53, 0.3);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  font-size: 16px;
  transition: all 0.3s ease;
}

.input:focus {
  outline: none;
  border-color: #ff6b35;
  box-shadow: 0 0 10px rgba(255, 107, 53, 0.3);
}

.input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn {
  padding: 12px 20px;
  border: none;
  border-radius: 5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-family: 'Montserrat', sans-serif;
}

.btn-primary {
  background: linear-gradient(45deg, #ff6b35, #f7931e);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(255, 107, 53, 0.4);
}

.btn-success {
  background: linear-gradient(45deg, #28a745, #20c997);
  color: white;
}

.btn-success:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(40, 167, 69, 0.4);
}

.btn-danger {
  background: linear-gradient(45deg, #dc3545, #c82333);
  color: white;
}

.btn-danger:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(220, 53, 69, 0.4);
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

/* Icon spacing in buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn .material-icons {
  font-size: 18px;
}

.section-title .material-icons {
  font-size: 1.2em;
}

.btn-secondary {
  background: linear-gradient(45deg, #6c757d, #5a6268);
  color: white;
}

.btn-secondary:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(108, 117, 125, 0.4);
}

.players-list {
  display: grid;
  gap: 10px;
}

.player-card {
  padding: 15px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 107, 53, 0.2);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.player-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.player-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.player-edit {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.player-edit-input {
  flex: 1;
}

.player-edit-controls {
  display: flex;
  gap: 8px;
}

.player-card:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: #ff6b35;
}

.player-name {
  font-weight: 600;
  font-size: 1.1rem;
}

.player-stats {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
}

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

.position-select {
  padding: 8px 12px;
  border: 1px solid rgba(255, 107, 53, 0.3);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  font-size: 14px;
}

.position-select option {
  background: #2d2d2d;
  color: #ffffff;
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

.match-history {
  display: grid;
  gap: 15px;
}

.match-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 107, 53, 0.2);
  border-radius: 8px;
  padding: 15px;
}

.match-date {
  color: #ff6b35;
  font-weight: bold;
  margin-bottom: 10px;
  font-size: 0.9rem;
}

.match-results {
  display: grid;
  gap: 5px;
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

/* View Mode Styles */
.view-mode {
  animation: fadeIn 0.3s ease-in;
}

.season-info-display {
  background: rgba(255, 107, 53, 0.1);
  border: 1px solid rgba(255, 107, 53, 0.3);
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 20px;
}

.season-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-item:last-child {
  border-bottom: none;
}

.stat-label {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

.stat-value {
  font-weight: bold;
  color: #ff6b35;
  font-size: 1.1em;
}

.recent-matches {
  display: grid;
  gap: 15px;
}

.match-card-simple {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 107, 53, 0.2);
  border-radius: 10px;
  padding: 20px;
  transition: all 0.3s ease;
}

.match-card-simple:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 107, 53, 0.4);
  transform: translateY(-2px);
}

.match-results-simple {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.match-result-simple {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 8px 0;
}

.position-simple {
  background: linear-gradient(45deg, #ff6b35, #f7931e);
  color: white;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
}

/* View Mode Layout */
.main-layout {
  display: flex;
  gap: 30px;
  align-items: flex-start;
}

.main-content {
  flex: 1;
  min-width: 0;
}

.sidebar {
  width: 300px;
  flex-shrink: 0;
}

.sidebar-section {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 107, 53, 0.2);
  border-radius: 15px;
  padding: 20px;
  margin-bottom: 20px;
}

.sidebar-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #ff6b35;
}

.sidebar-title .material-icons {
  font-size: 20px;
}

.subtitle {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 16px;
  font-style: italic;
}

.subtitle small {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  font-style: normal;
}

.wins-ranking {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wins-ranking-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  transition: background 0.2s ease;
}

.wins-ranking-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.wins-rank {
  width: 24px;
  height: 24px;
  background: #ff6b35;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.8rem;
  flex-shrink: 0;
}

.wins-player {
  flex: 1;
  min-width: 0;
}

.wins-player-name {
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
  word-break: break-word;
}

.wins-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wins-count {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
}

.wins-count .material-icons {
  font-size: 14px;
  color: #ff6b35;
}

/* Global Ranking Enhancements */
.wins-ranking-item {
  position: relative;
}

.rank-champion {
  background: linear-gradient(45deg, #ffd700, #ffed4e) !important;
  color: #333 !important;
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.4) !important;
  animation: championGlow 2s ease-in-out infinite alternate;
}

.champion-badge {
  position: absolute;
  right: -8px;
  top: -8px;
  width: 24px;
  height: 24px;
  background: linear-gradient(45deg, #ffd700, #ffed4e);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 10px rgba(255, 215, 0, 0.5);
}

.champion-badge .material-icons {
  font-size: 14px;
  color: #333;
}


@keyframes championGlow {
  from {
    box-shadow: 0 4px 15px rgba(255, 215, 0, 0.4);
  }

  to {
    box-shadow: 0 6px 20px rgba(255, 215, 0, 0.7);
  }
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
.total-wins {
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

/* Available Players Styles */
.available-players {
  margin: 20px 0;
  padding: 20px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  border: 1px solid rgba(255, 107, 53, 0.2);
}

.available-players h4 {
  margin: 0 0 15px 0;
  color: #ff6b35;
  font-weight: 600;
}

.players-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 10px;
}

.available-player-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  transition: background 0.2s ease;
}

.available-player-card:hover {
  background: rgba(255, 255, 255, 0.08);
}

.available-player-card .player-name {
  font-weight: 500;
  color: #fff;
}

/* Responsive Design */
@media (max-width: 768px) {
  .main-layout {
    flex-direction: column;
    gap: 20px;
  }

  .sidebar {
    width: 100%;
    order: -1;
    /* Показываем глобальный рейтинг вверху на мобильных */
  }

  .players-grid {
    grid-template-columns: 1fr;
  }

  .tab-navigation {
    margin: 15px 10px;
    padding: 4px;
    width: calc(100% - 20px);
    max-width: calc(100% - 20px);
  }

  .tab-btn {
    padding: 10px 8px;
    min-width: 0;
    font-size: 0.75rem;
    letter-spacing: 0.5px;
    gap: 4px;
    flex: 1;
  }

  .tab-btn .material-icons {
    font-size: 16px;
  }

  /* Podium Mobile Styles */
  .podium {
    padding: 20px 10px;
    margin-bottom: 15px;
  }

  .podium-positions {
    gap: 10px;
    min-height: 200px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .podium-item {
    min-width: 90px;
  }

  .podium-avatar {
    width: 60px;
    height: 60px;
  }

  .podium-avatar.champion {
    width: 70px;
    height: 70px;
  }

  .podium-avatar .material-icons {
    font-size: 30px;
  }

  .podium-avatar.champion .material-icons {
    font-size: 35px;
  }

  .podium-medal {
    width: 35px;
    height: 35px;
  }

  .podium-name {
    font-size: 0.9rem;
  }

  .champion-name {
    font-size: 1rem;
  }

  .podium-stats .stat {
    font-size: 0.8rem;
  }

  .podium-base {
    width: 90px;
  }

  .podium-base-1 {
    height: 80px;
  }

  .podium-base-2 {
    height: 60px;
  }

  .podium-base-3 {
    height: 50px;
  }

  /* Leaderboard Mobile Styles */
  .leaderboard-item-enhanced {
    padding: 15px;
    flex-wrap: wrap;
    gap: 10px;
  }

  .player-rank {
    margin-right: 10px;
  }

  .rank-circle {
    width: 40px;
    height: 40px;
    font-size: 1rem;
  }

  .player-avatar-small {
    width: 35px;
    height: 35px;
    margin-right: 10px;
  }

  .player-avatar-small .material-icons {
    font-size: 20px;
  }

  .player-details-enhanced {
    flex: 1;
    margin-right: 10px;
    min-width: 0;
  }

  .player-name-enhanced {
    font-size: 1rem;
    margin-bottom: 6px;
  }

  .progress-bar {
    height: 6px;
  }

  .progress-text {
    font-size: 0.8rem;
    min-width: 70px;
  }

  .player-stats-enhanced {
    gap: 15px;
    margin-right: 10px;
    width: 100%;
    justify-content: space-around;
    margin-top: 10px;
  }

  .stat-item .material-icons {
    font-size: 16px;
  }

  .player-badge {
    margin-top: 10px;
    width: 100%;
    justify-content: center;
  }

  /* Recent Matches Mobile */
  .match-card-simple {
    padding: 12px;
  }

  .match-results-simple {
    gap: 8px;
  }

  .match-result-simple {
    padding: 8px;
    flex-wrap: wrap;
  }

  .position-simple {
    min-width: 20px;
    font-size: 0.8rem;
  }

  /* Container and Section Mobile */
  .container {
    padding: 10px;
    margin: 0;
    max-width: 100%;
    width: 100%;
  }

  .section {
    margin-bottom: 20px;
  }

  .section-title {
    font-size: 1.3rem;
    margin-bottom: 15px;
  }

  /* Season Info Mobile */
  .season-stats {
    flex-wrap: wrap;
    gap: 10px;
  }

  .stat-item {
    min-width: calc(50% - 5px);
  }

  /* Global Ranking Mobile */
  .wins-ranking-item {
    padding: 10px;
    gap: 8px;
  }

  .wins-rank {
    width: 30px;
    height: 30px;
    font-size: 0.9rem;
  }

  .wins-player-name {
    font-size: 0.9rem;
  }

  .wins-count {
    font-size: 0.8rem;
  }

  .wins-count .material-icons {
    font-size: 12px;
  }

  /* Header Mobile */
  .header {
    padding: 15px 10px;
  }

  .title {
    font-size: 2rem;
  }

  .title-sub {
    font-size: 0.8rem;
    letter-spacing: 4px;
  }

  /* Champion Badge Mobile */
  .champion-badge {
    right: -6px;
    top: -6px;
    width: 20px;
    height: 20px;
  }

  .champion-badge .material-icons {
    font-size: 12px;
  }

  /* Sidebar Mobile */
  .sidebar-section {
    padding: 15px;
    margin-bottom: 15px;
  }

  .sidebar-title {
    font-size: 1rem;
  }

  .subtitle {
    font-size: 0.8rem;
    margin-bottom: 12px;
  }
}

/* Mode Styles */
.season-mode,
.players-mode {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Enhanced Leaderboard Styles */
.leaderboard-enhanced {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

/* Podium Styles */
.podium {
  background: linear-gradient(135deg, rgba(255, 107, 53, 0.1), rgba(247, 147, 30, 0.1));
  border-radius: 20px;
  padding: 30px;
  margin-bottom: 20px;
}

.podium-positions {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 20px;
  min-height: 300px;
}

.podium-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.podium-first {
  order: 2;
}

.podium-second {
  order: 1;
}

.podium-third {
  order: 3;
}

.podium-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 10px;
  z-index: 2;
}

.podium-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(45deg, #ff6b35, #f7931e);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
  position: relative;
  box-shadow: 0 8px 25px rgba(255, 107, 53, 0.3);
}

.podium-avatar.champion {
  width: 100px;
  height: 100px;
  background: linear-gradient(45deg, #ffd700, #ffed4e);
}

.podium-avatar .material-icons {
  font-size: 40px;
  color: white;
}

.podium-avatar.champion .material-icons {
  font-size: 50px;
  color: #333;
}

.podium-medal {
  position: relative;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.podium-medal.gold {
  background: linear-gradient(45deg, #ffd700, #ffed4e);
  color: #333;
}

.podium-medal.silver {
  background: linear-gradient(45deg, #c0c0c0, #e8e8e8);
  color: #333;
}

.podium-medal.bronze {
  background: linear-gradient(45deg, #cd7f32, #daa520);
  color: white;
}

.medal-number {
  position: absolute;
  font-weight: 800;
  font-size: 14px;
}

.podium-name {
  font-weight: 700;
  font-size: 1.1rem;
  text-align: center;
  margin-bottom: 8px;
  color: #fff;
}

.champion-name {
  color: #ffd700;
  font-size: 1.3rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.podium-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
}

.podium-stats .stat {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.8);
}

.podium-base {
  width: 120px;
  border-radius: 10px 10px 0 0;
  position: relative;
}

.podium-base-1 {
  height: 120px;
  background: linear-gradient(45deg, #ffd700, #ffed4e);
  box-shadow: 0 -5px 20px rgba(255, 215, 0, 0.3);
}

.podium-base-2 {
  height: 90px;
  background: linear-gradient(45deg, #c0c0c0, #e8e8e8);
  box-shadow: 0 -5px 20px rgba(192, 192, 192, 0.3);
}

.podium-base-3 {
  height: 70px;
  background: linear-gradient(45deg, #cd7f32, #daa520);
  box-shadow: 0 -5px 20px rgba(205, 127, 50, 0.3);
}

/* Enhanced Leaderboard List */
.leaderboard-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.leaderboard-item-enhanced {
  display: flex;
  align-items: center;
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 107, 53, 0.2);
  border-radius: 15px;
  transition: all 0.3s ease;
  position: relative;
}

.leaderboard-item-enhanced:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 107, 53, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(255, 107, 53, 0.2);
}

.leaderboard-item-enhanced.top-three {
  border-width: 2px;
  box-shadow: 0 4px 20px rgba(255, 107, 53, 0.15);
}

.player-rank {
  margin-right: 20px;
}

.rank-circle {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.2rem;
}

.rank-circle.gold {
  background: linear-gradient(45deg, #ffd700, #ffed4e);
  color: #333;
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
}

.rank-circle.silver {
  background: linear-gradient(45deg, #c0c0c0, #e8e8e8);
  color: #333;
  box-shadow: 0 4px 15px rgba(192, 192, 192, 0.3);
}

.rank-circle.bronze {
  background: linear-gradient(45deg, #cd7f32, #daa520);
  color: white;
  box-shadow: 0 4px 15px rgba(205, 127, 50, 0.3);
}

.rank-circle.default {
  background: linear-gradient(45deg, #6c757d, #495057);
  color: white;
}

.player-avatar-small {
  width: 45px;
  height: 45px;
  border-radius: 50%;
  background: linear-gradient(45deg, #ff6b35, #f7931e);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20px;
  box-shadow: 0 4px 15px rgba(255, 107, 53, 0.2);
}

.player-avatar-small .material-icons {
  color: white;
  font-size: 24px;
}

.player-details-enhanced {
  flex: 1;
  margin-right: 20px;
}

.player-name-enhanced {
  font-weight: 700;
  font-size: 1.2rem;
  color: #fff;
  margin-bottom: 8px;
}

.player-progress {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff6b35, #f7931e);
  border-radius: 4px;
  transition: width 0.3s ease-out;
}

.progress-text {
  font-weight: 600;
  color: #ff6b35;
  font-size: 0.9rem;
  min-width: 80px;
}

.player-stats-enhanced {
  display: flex;
  gap: 20px;
  margin-right: 20px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.8);
}

.stat-item .material-icons {
  font-size: 18px;
  color: #ff6b35;
}

.stat-value {
  font-weight: 600;
  color: #fff;
}

.player-badge {
  background: #ffd700;
  color: #333;
  padding: 6px 12px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}


.controls {
  text-align: center;
}

.empty-state {
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  padding: 40px;
  font-style: italic;
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

@media (max-width: 768px) {
  .container {
    padding: 10px;
  }

  .title-main {
    font-size: 2rem;
  }

  .title-sub {
    font-size: 1rem;
    letter-spacing: 4px;
  }

  .add-player {
    flex-direction: column;
  }

  .match-player {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }

  .position-controls {
    justify-content: center;
  }

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
}
</style>