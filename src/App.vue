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
const currentMatch = ref<{ playerId: number; winsInMatch: number }[]>([])
const isLoading = ref(false)
const selectedPlayersForSeason = ref<number[]>([])

// Tab system
const activeTab = ref<'view' | 'season' | 'players'>('view')

// Editing states
const editingPlayer = ref<{ id: number; name: string } | null>(null)
const editingGlobalPlayer = ref<{ id: number; name: string } | null>(null)
const editingSeason = ref<{ id: number; name: string } | null>(null)
const editingMatch = ref<{ id: number; players: { playerId: number; winsInMatch: number }[] } | null>(null)
const showMatchDetails = ref<{ [key: number]: boolean }>({})
const showPlayerDetails = ref<{ [key: number]: boolean }>({})
const showAddMatchModal = ref(false)

// Computed current season
const currentSeason = computed(() => {
  return seasons.value.find(s => s.id === currentSeasonId.value) || null
})

// Computed players and matches for current season
const players = computed(() => currentSeason.value?.players || [])
const matches = computed(() => currentSeason.value?.matches || [])

// Функция для расчета позиций на основе количества побед
const calculatePositionsFromWins = (players: { playerId: number; winsInMatch: number }[]) => {
  // Сортируем игроков по количеству побед (по убыванию)
  const sorted = [...players].sort((a, b) => b.winsInMatch - a.winsInMatch)

  let currentPosition = 1
  const result: { playerId: number; winsInMatch: number; position: number }[] = []

  for (let i = 0; i < sorted.length; i++) {
    const player = sorted[i]

    // Если это не первый игрок и у него такое же количество побед, как у предыдущего
    if (i > 0 && sorted[i - 1].winsInMatch === player.winsInMatch) {
      // Оставляем ту же позицию
    } else {
      // Обновляем позицию
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

// Получить общее количество побед в матчах для игрока (сумма всех wins_in_match)
const getTotalMatchWinsForPlayer = (playerId: number) => {
  return seasons.value.reduce((total, season) => {
    return total + season.matches.reduce((matchTotal, match) => {
      const playerInMatch = match.players.find(p => p.playerId === playerId)
      return matchTotal + (playerInMatch?.winsInMatch || 0)
    }, 0)
  }, 0)
}

// Получить количество побед в матчах для игрока в конкретном сезоне
const getSeasonMatchWinsForPlayer = (playerId: number, seasonId: number) => {
  const season = seasons.value.find(s => s.id === seasonId)
  if (!season) return 0

  return season.matches.reduce((total, match) => {
    const playerInMatch = match.players.find(p => p.playerId === playerId)
    return total + (playerInMatch?.winsInMatch || 0)
  }, 0)
}

// Получить детальную статистику игрока
const getDetailedPlayerStats = (playerId: number) => {
  const stats = {
    totalMatches: 0,
    totalVictories: 0, // Общее количество побед в играх (wins_in_match)
    totalPoints: 0,
    seasonWins: 0,
    positionStats: {
      1: 0, // Количество 1-х мест
      2: 0, // Количество 2-х мест  
      3: 0, // Количество 3-х мест
      4: 0, // Количество 4-х мест
      5: 0, // Количество 5-х мест
      6: 0  // Количество 6-х мест
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

  seasons.value.forEach(season => {
    const playerInSeason = season.players.find(p => p.playerId === playerId)
    if (playerInSeason) {
      stats.seasonsParticipated++
      stats.totalPoints += playerInSeason.points

      // Проверяем, выиграл ли игрок этот сезон
      if (season.players.length > 0) {
        const maxPoints = Math.max(...season.players.map(p => p.points))
        const seasonWinners = season.players.filter(p => p.points === maxPoints)
        if (seasonWinners.some(w => w.playerId === playerId)) {
          stats.seasonWins++
        }
      }

      // Анализируем матчи этого сезона
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

            // Лучшая и худшая позиции
            if (stats.bestPosition === null || position < stats.bestPosition) {
              stats.bestPosition = position
            }
            if (stats.worstPosition === null || position > stats.worstPosition) {
              stats.worstPosition = position
            }
          }

          // Подсчет побед в матчах (1-е места)
          if (position === 1) {
            // Уже считается в positionStats[1]
          }
        }
      })
    }
  })

  // Вычисляем средние значения
  if (matchCount > 0) {
    stats.averagePosition = Math.round((totalPositionSum / matchCount) * 100) / 100
    stats.averagePoints = Math.round((stats.totalPoints / matchCount) * 100) / 100
    stats.averageVictoriesPerMatch = Math.round((stats.totalVictories / matchCount) * 100) / 100
  }

  return stats
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

// Add player to current match with wins count
const addToCurrentMatch = (playerId: number, winsInMatch: number) => {
  // Remove if already in match
  currentMatch.value = currentMatch.value.filter(m => m.playerId !== playerId)
  // Add with new wins count
  currentMatch.value.push({ playerId, winsInMatch })
  // Sort by wins count (descending)
  currentMatch.value.sort((a, b) => b.winsInMatch - a.winsInMatch)
}

// Remove player from current match
const removeFromCurrentMatch = (playerId: number) => {
  currentMatch.value = currentMatch.value.filter(m => m.playerId !== playerId)
}

// Modal functions
const openAddMatchModal = () => {
  if (!currentSeason.value || players.value.length === 0) return
  currentMatch.value = []
  showAddMatchModal.value = true
}

const closeAddMatchModal = () => {
  showAddMatchModal.value = false
  currentMatch.value = []
}

// Save current match
const saveMatch = async () => {
  if (currentMatch.value.length === 0 || !currentSeason.value || isLoading.value) return

  isLoading.value = true
  try {
    // Calculate positions based on wins and add pointsEarned
    const playersWithPositions = calculatePositionsFromWins(currentMatch.value)
    const matchPlayersWithPoints = playersWithPositions.map(mp => ({
      playerId: mp.playerId,
      winsInMatch: mp.winsInMatch,
      position: mp.position,
      pointsEarned: calculatePoints(mp.position, playersWithPositions)
    }))

    const savedMatch = await scoreboardService.saveMatch(currentSeason.value.id, matchPlayersWithPoints)
    if (savedMatch) {
      await loadSeasons()
      // Clear current match and close modal
      currentMatch.value = []
      if (showAddMatchModal.value) {
        showAddMatchModal.value = false
      }
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

// Computed leaderboard with proper tie handling
const leaderboard = computed(() => {
  const sortedPlayers = [...players.value]
    .sort((a, b) => {
      // First by points (descending)
      if (b.points !== a.points) return b.points - a.points
      // Then by wins (descending)
      if (b.wins !== a.wins) return b.wins - a.wins
      // Then by name (ascending)
      return a.name.localeCompare(b.name)
    })

  // Assign ranks with proper tie handling
  let currentRank = 1
  return sortedPlayers.map((player, index) => {
    if (index > 0) {
      const prevPlayer = sortedPlayers[index - 1]
      // Only increment rank if points AND wins are different
      if (player.points !== prevPlayer.points || player.wins !== prevPlayer.wins) {
        currentRank = index + 1
      }
    }
    return { ...player, rank: currentRank }
  })
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
    totalMatchVictories: number; // Общее количество побед в матчах (wins_in_match)
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

      // Подсчитываем общее количество побед в матчах для этого игрока в этом сезоне
      const matchVictories = season.matches.reduce((total, match) => {
        const playerInMatch = match.players.find(p => p.playerId === player.playerId)
        return total + (playerInMatch?.winsInMatch || 0)
      }, 0)

      if (existing) {
        existing.totalMatchWins += player.wins
        existing.totalMatchVictories += matchVictories
        if (isSeasonWinner) existing.seasonWins += 1
        existing.seasonsParticipated += 1
      } else {
        playerStatsMap.set(player.playerId, {
          name: player.name,
          totalMatchWins: player.wins,
          totalMatchVictories: matchVictories,
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
      totalMatchVictories: data.totalMatchVictories,
      seasonWins: data.seasonWins,
      seasonsParticipated: data.seasonsParticipated
    }))
    .sort((a, b) => {
      // Sort by season wins first (descending)
      if (b.seasonWins !== a.seasonWins) return b.seasonWins - a.seasonWins
      // Then by total match wins (descending)
      if (b.totalMatchWins !== a.totalMatchWins) return b.totalMatchWins - a.totalMatchWins
      // Then by total match victories (descending)
      if (b.totalMatchVictories !== a.totalMatchVictories) return b.totalMatchVictories - a.totalMatchVictories
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

// Get player wins in current match
const getPlayerWinsInMatch = (playerId: number): number | null => {
  const match = currentMatch.value.find(m => m.playerId === playerId)
  return match ? match.winsInMatch : null
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

const saveMatchEdit = async () => {
  if (!editingMatch.value || isLoading.value) return

  isLoading.value = true
  try {
    // Calculate positions based on wins and add pointsEarned
    const playersWithPositions = calculatePositionsFromWins(editingMatch.value.players)
    const matchPlayersWithPoints = playersWithPositions.map(mp => ({
      playerId: mp.playerId,
      winsInMatch: mp.winsInMatch,
      position: mp.position,
      pointsEarned: calculatePoints(mp.position, playersWithPositions)
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


const togglePlayerDetails = (playerId: number) => {
  showPlayerDetails.value[playerId] = !showPlayerDetails.value[playerId]
}

// Вспомогательная функция для получения количества мест
const getPositionCount = (playerId: number, position: number) => {
  const stats = getDetailedPlayerStats(playerId)
  return stats.positionStats[position as keyof typeof stats.positionStats] || 0
}

const updateEditingMatchPlayer = (playerId: number, winsInMatch: number) => {
  if (!editingMatch.value) return

  // Remove if already in match
  editingMatch.value.players = editingMatch.value.players.filter(m => m.playerId !== playerId)
  // Add with new wins count
  editingMatch.value.players.push({ playerId, winsInMatch })
  // Sort by wins count (descending)
  editingMatch.value.players.sort((a, b) => b.winsInMatch - a.winsInMatch)
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
          <div class="season-info-display">
            <div class="season-header-info">
              <div class="season-title-info">
                <h2 class="season-name-display">{{ currentSeason.name }}</h2>
                <div class="season-status-info">
                  <span v-if="!currentSeason.endDate" class="status-active">
                    <span class="material-icons">play_circle</span>
                    Активный
                  </span>
                  <span v-else class="status-completed">
                    <span class="material-icons">check_circle</span>
                    Завершен
                  </span>
                </div>
              </div>
              <div class="season-date-info">
                <span class="material-icons">event</span>
                <div class="date-range">
                  <span class="start-date">{{ currentSeason.startDate }}</span>
                  <span v-if="currentSeason.endDate" class="end-date">— {{ currentSeason.endDate }}</span>
                </div>
              </div>
            </div>

            <div class="season-stats-grid">
              <div class="stat-card">
                <div class="stat-icon">
                  <span class="material-icons">group</span>
                </div>
                <div class="stat-content">
                  <div class="stat-number">{{ currentSeason.players.length }}</div>
                  <div class="stat-label">игроков</div>
                </div>
              </div>

              <div class="stat-card">
                <div class="stat-icon">
                  <span class="material-icons">calendar_today</span>
                </div>
                <div class="stat-content">
                  <div class="stat-number">{{ currentSeason.matches.length }}</div>
                  <div class="stat-label">дней</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Floating Add Match Button -->
        <button v-if="currentSeason && players.length > 0" @click="openAddMatchModal" class="floating-add-btn"
          title="Добавить новый матч">
          <span class="material-icons">add</span>
        </button>

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
                        <div class="podium-avatar" :class="{ 'champion': leaderboard[1].rank === 1 }">
                          <span class="material-icons">person</span>
                        </div>
                        <div class="podium-medal" :class="getRankClass(leaderboard[1].rank)">
                          <span class="material-icons">{{ getRankIcon(leaderboard[1].rank) }}</span>
                          <span class="medal-number">{{ leaderboard[1].rank }}</span>
                        </div>
                        <div class="podium-name" :class="{ 'champion-name': leaderboard[1].rank === 1 }">{{
                          leaderboard[1].name }}</div>
                        <div class="podium-stats">
                          <div class="stat">{{ leaderboard[1].points }} очков</div>
                          <div class="stat">{{ leaderboard[1].wins }} побед</div>
                          <div class="stat">{{ getSeasonMatchWinsForPlayer(leaderboard[1].playerId, currentSeasonId ||
                            0) }} матчей</div>
                        </div>
                      </div>
                      <div class="podium-base" :class="`podium-base-${leaderboard[1].rank}`"></div>
                    </div>

                    <!-- 1st Place -->
                    <div class="podium-item podium-first" v-if="leaderboard[0]">
                      <div class="podium-player">
                        <div class="podium-avatar" :class="{ 'champion': leaderboard[0].rank === 1 }">
                          <span class="material-icons">person</span>
                        </div>
                        <div class="podium-medal" :class="getRankClass(leaderboard[0].rank)">
                          <span class="material-icons">{{ getRankIcon(leaderboard[0].rank) }}</span>
                          <span class="medal-number">{{ leaderboard[0].rank }}</span>
                        </div>
                        <div class="podium-name" :class="{ 'champion-name': leaderboard[0].rank === 1 }">{{
                          leaderboard[0].name }}</div>
                        <div class="podium-stats">
                          <div class="stat">{{ leaderboard[0].points }} очков</div>
                          <div class="stat">{{ leaderboard[0].wins }} побед</div>
                          <div class="stat">{{ getSeasonMatchWinsForPlayer(leaderboard[0].playerId, currentSeasonId ||
                            0) }}
                            матчей</div>
                        </div>
                      </div>
                      <div class="podium-base" :class="`podium-base-${leaderboard[0].rank}`"></div>
                    </div>

                    <!-- 3rd Place -->
                    <div class="podium-item podium-third" v-if="leaderboard[2]">
                      <div class="podium-player">
                        <div class="podium-avatar" :class="{ 'champion': leaderboard[2].rank === 1 }">
                          <span class="material-icons">person</span>
                        </div>
                        <div class="podium-medal" :class="getRankClass(leaderboard[2].rank)">
                          <span class="material-icons">{{ getRankIcon(leaderboard[2].rank) }}</span>
                          <span class="medal-number">{{ leaderboard[2].rank }}</span>
                        </div>
                        <div class="podium-name" :class="{ 'champion-name': leaderboard[2].rank === 1 }">{{
                          leaderboard[2].name }}</div>
                        <div class="podium-stats">
                          <div class="stat">{{ leaderboard[2].points }} очков</div>
                          <div class="stat">{{ leaderboard[2].wins }} побед</div>
                          <div class="stat">{{ getSeasonMatchWinsForPlayer(leaderboard[2].playerId, currentSeasonId ||
                            0) }}
                            матчей</div>
                        </div>
                      </div>
                      <div class="podium-base" :class="`podium-base-${leaderboard[2].rank}`"></div>
                    </div>
                  </div>
                </div>

                <!-- Detailed Leaderboard -->
                <div class="leaderboard-list">
                  <div v-for="(player, index) in leaderboard" :key="player.id" class="leaderboard-item-enhanced"
                    :class="{ 'top-three': player.rank <= 3 }">

                    <div class="player-rank">
                      <div class="rank-circle" :class="getRankClass(player.rank)">
                        <span v-if="player.rank <= 3" class="material-icons">{{ getRankIcon(player.rank) }}</span>
                        <span v-else class="rank-number">{{ player.rank }}</span>
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
                        <span class="stat-label">побед</span>
                      </div>
                      <div class="stat-item">
                        <span class="material-icons">emoji_events</span>
                        <span class="stat-value">{{ getSeasonMatchWinsForPlayer(player.playerId, currentSeasonId || 0)
                        }}</span>
                        <span class="stat-label">матчей</span>
                      </div>
                      <div class="stat-item">
                        <span class="material-icons">stars</span>
                        <span class="stat-value">{{ player.points }}</span>
                        <span class="stat-label">очков</span>
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
                <div v-for="(match, index) in matches.slice().reverse().slice(0, 5)" :key="match.id"
                  class="match-card-enhanced">
                  <div class="match-header-enhanced">
                    <div class="match-date-info">
                      <span class="material-icons">event</span>
                      <span class="match-date">{{ match.date }}</span>
                      <span class="match-number">#{{ matches.length - index }}</span>
                    </div>
                    <div class="match-participants">
                      <span class="material-icons">group</span>
                      <span>{{ match.players.length }} игроков</span>
                    </div>
                  </div>

                  <div class="match-summary">
                    <!-- Winner highlight -->
                    <div class="match-winner">
                      <span class="material-icons">emoji_events</span>
                      <span class="winner-text">{{match.players.filter(p => p.position === 1).length > 1 ?
                        'Победители:' : 'Победитель:'}}</span>
                      <div class="winners-list">
                        <span v-for="(winner, index) in match.players.filter(p => p.position === 1)"
                          :key="winner.playerId" class="winner-name">
                          {{ getPlayerName(winner.playerId) }}{{index < match.players.filter(p => p.position ===
                            1).length - 1 ? ', ' : ''}}
                        </span>
                      </div>
                      <span class="winner-score">{{match.players.find(p => p.position === 1)?.winsInMatch}}
                        побед</span>
                    </div>

                    <!-- Quick results -->
                    <div class="match-results-enhanced">
                      <div v-for="result in match.players" :key="result.playerId" class="match-result-enhanced">
                        <div class="result-position" :class="`position-${result.position}`">{{ result.position }}</div>
                        <div class="result-player">
                          <span class="player-name">{{ getPlayerName(result.playerId) }}</span>
                          <span class="player-performance">{{ result.winsInMatch }} побед</span>
                        </div>
                        <div class="result-points">+{{ result.pointsEarned }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <!-- Sidebar - Global Stats and Ranking -->
          <div class="sidebar">
            <!-- Global Statistics -->
            <div class="sidebar-section">
              <h3 class="sidebar-title">
                <span class="material-icons">analytics</span>
                Общая статистика
              </h3>
              <div class="global-stats">
                <div class="global-stat-item">
                  <div class="global-stat-icon">
                    <span class="material-icons">sports</span>
                  </div>
                  <div class="global-stat-content">
                    <div class="global-stat-number">{{ seasons.length }}</div>
                    <div class="global-stat-label">сезонов</div>
                  </div>
                </div>

                <div class="global-stat-item">
                  <div class="global-stat-icon">
                    <span class="material-icons">calendar_today</span>
                  </div>
                  <div class="global-stat-content">
                    <div class="global-stat-number">{{seasons.reduce((sum, season) => sum + season.matches.length, 0)
                    }}</div>
                    <div class="global-stat-label">дней</div>
                  </div>
                </div>

                <div class="global-stat-item">
                  <div class="global-stat-icon">
                    <span class="material-icons">stars</span>
                  </div>
                  <div class="global-stat-content">
                    <div class="global-stat-number">{{seasons.reduce((sum, season) => sum +
                      season.matches.reduce((matchSum, match) => matchSum + match.players.reduce((playerSum, player) =>
                        playerSum + player.pointsEarned, 0), 0), 0)}}</div>
                    <div class="global-stat-label">очков</div>
                  </div>
                </div>

                <div class="global-stat-item">
                  <div class="global-stat-icon">
                    <span class="material-icons">trending_up</span>
                  </div>
                  <div class="global-stat-content">
                    <div class="global-stat-number">{{seasons.reduce((sum, season) => sum +
                      season.matches.reduce((matchSum, match) => matchSum + match.players.reduce((playerSum, player) =>
                        playerSum + player.winsInMatch, 0), 0), 0)}}</div>
                    <div class="global-stat-label">матчей</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="sidebar-section">
              <h3 class="sidebar-title">
                <span class="material-icons">emoji_events</span>
                Глобальный рейтинг
              </h3>
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
                      <div class="wins-count">
                        <span class="material-icons">trending_up</span>
                        {{ player.totalMatchVictories }} матчей
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="globalWinsRanking.length > 0 && player.seasonWins === globalWinsRanking[0].seasonWins && player.seasonWins > 0"
                    class="champion-badge">
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
                      <span>{{match.players.reduce((sum, p) => sum + p.winsInMatch, 0)}} побед</span>
                    </div>
                  </div>
                </div>
                <div class="match-controls">
                  <button v-if="!editingMatch" @click="startEditingMatch(match)" class="btn btn-secondary btn-small">
                    <span class="material-icons">edit</span>
                    Редактировать
                  </button>
                  <button v-if="!editingMatch" @click="deleteMatch(match.id)" class="btn btn-danger btn-small">
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
    </div>

    <!-- Add Match Modal -->
    <div v-if="showAddMatchModal" class="modal-overlay" @click="closeAddMatchModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">
            <span class="material-icons">add_circle</span>
            Добавить новый матч
          </h2>
          <button @click="closeAddMatchModal" class="modal-close-btn">
            <span class="material-icons">close</span>
          </button>
        </div>

        <div class="modal-body">
          <div class="match-players-modal">
            <div v-for="player in players" :key="player.id" class="modal-player-entry">
              <div class="player-info-modal">
                <span class="player-name-modal">{{ player.name }}</span>
                <div class="player-current-stats">
                  <span class="current-points">{{ player.points }} очков</span>
                  <span class="current-wins">{{ player.wins }} побед</span>
                </div>
              </div>
              <div class="wins-input-container">
                <input type="number" min="0" max="50" placeholder="0"
                  :value="getPlayerWinsInMatch(player.playerId) || ''"
                  @input="addToCurrentMatch(player.playerId, parseInt(($event.target as HTMLInputElement).value) || 0)"
                  class="wins-input-modal" />
                <label class="wins-label">побед</label>
              </div>
            </div>
          </div>

          <div v-if="currentMatch.length > 0" class="match-preview-modal">
            <div class="preview-header">
              <h3>Предварительные результаты</h3>
              <span class="participants-count">{{ currentMatch.length }} участников</span>
            </div>

            <div class="preview-results">
              <div v-for="result in calculatePositionsFromWins(currentMatch)" :key="result.playerId"
                class="preview-result">
                <div class="result-position-modal" :class="`position-${result.position}`">{{ result.position }}</div>
                <div class="result-info-modal">
                  <span class="player-name-result">{{ getPlayerName(result.playerId) }}</span>
                  <span class="wins-count-result">{{ result.winsInMatch }} побед</span>
                </div>
                <div class="points-earned-modal">+{{ calculatePoints(result.position,
                  calculatePositionsFromWins(currentMatch)) }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeAddMatchModal" class="btn btn-secondary">
            <span class="material-icons">close</span>
            Отмена
          </button>
          <button @click="saveMatch" class="btn btn-success" :disabled="currentMatch.length === 0 || isLoading">
            <span class="material-icons">save</span>
            {{ isLoading ? 'Сохранение...' : 'Сохранить матч' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  background: #1a1a1a;
  color: #ffffff;
  font-family: "Montserrat", sans-serif;
  overflow-x: hidden;
  width: 100%;
  max-width: 100%;
}

.header {
  background: #ff6b35;
  padding: 20px 0 10px 0;
  text-align: center;
  border-bottom: 2px solid #ff6b35;
  width: 100%;
  overflow-x: hidden;
}

.title {
  margin: 0;
  font-weight: 700;
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
  gap: 2px;
  margin-top: 20px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 4px;
  width: fit-content;
  max-width: 100%;
  margin-left: auto;
  margin-right: auto;
  overflow: hidden;
}

.tab-btn {
  padding: 12px 20px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s ease;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
  min-width: 100px;
  flex: 1;
}

.tab-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
}

.tab-btn.active {
  background: #ff6b35;
  color: #ffffff;
}

.tab-btn.active:hover {
  background: #ff6b35;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
}

.section {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 107, 53, 0.3);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.section-title {
  color: #ff6b35;
  margin: 0 0 16px 0;
  font-size: 1.4rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
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
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.btn-primary {
  background: #ff6b35;
  color: white;
}

.btn-primary:hover {
  background: #e55a2b;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover {
  background: #218838;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
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
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.players-list {
  display: grid;
  gap: 10px;
}

.player-card {
  padding: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 107, 53, 0.3);
  border-radius: 6px;
  transition: background-color 0.2s ease;
}

.player-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.player-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.player-edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.player-edit-input {
  flex: 1;
}

.player-edit-controls {
  display: flex;
  gap: 6px;
}

.player-card:hover {
  background: rgba(255, 255, 255, 0.08);
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

.wins-simple {
  background: linear-gradient(45deg, #ff6b35, #f7931e);
  color: white;
  padding: 2px 6px;
  border-radius: 8px;
  font-weight: bold;
  font-size: 10px;
  min-width: 30px;
  text-align: center;
}

.wins-badge {
  background: linear-gradient(45deg, #ff6b35, #f7931e);
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-weight: bold;
  font-size: 12px;
  min-width: 40px;
  text-align: center;
  margin-right: 10px;
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

/* Keep original styles for compatibility */
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
  background: rgba(255, 107, 53, 0.08);
  border: 1px solid rgba(255, 107, 53, 0.3);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
}

.season-header-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.season-title-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.season-name-display {
  color: #ff6b35;
  margin: 0;
  font-size: 1.8rem;
  font-weight: 700;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.season-status-info {
  display: flex;
  align-items: center;
}

.status-active {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(40, 167, 69, 0.15);
  color: #28a745;
  border: 1px solid rgba(40, 167, 69, 0.3);
  border-radius: 16px;
  font-weight: 600;
  font-size: 0.85rem;
}

.status-completed {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(108, 117, 125, 0.15);
  color: #6c757d;
  border: 1px solid rgba(108, 117, 125, 0.3);
  border-radius: 16px;
  font-weight: 600;
  font-size: 0.85rem;
}

.status-active .material-icons,
.status-completed .material-icons {
  font-size: 16px;
}

.season-date-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

.season-date-info .material-icons {
  color: #ff6b35;
  font-size: 20px;
}

.date-range {
  display: flex;
  flex-direction: column;
  text-align: right;
}

.start-date {
  color: #fff;
  font-weight: 600;
}

.end-date {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
  margin-top: 2px;
}

.season-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.stat-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 107, 53, 0.4);
  box-shadow: 0 4px 15px rgba(255, 107, 53, 0.1);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(255, 107, 53, 0.2);
  border-radius: 10px;
  flex-shrink: 0;
}

.stat-icon .material-icons {
  color: #ff6b35;
  font-size: 20px;
}

.stat-content {
  flex: 1;
}

.stat-number {
  font-size: 1.6rem;
  font-weight: 700;
  color: #fff;
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

/* Enhanced Recent Matches */
.recent-matches {
  display: grid;
  gap: 20px;
}

.match-card-enhanced {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 107, 53, 0.2);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
}

.match-header-enhanced {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.match-date-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ff6b35;
  font-weight: 600;
}

.match-date-info .material-icons {
  font-size: 18px;
}

.match-number {
  background: rgba(255, 107, 53, 0.2);
  color: #ff6b35;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
}

.match-participants {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
}

.match-participants .material-icons {
  font-size: 16px;
}

.match-summary {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.match-winner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(255, 215, 0, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.match-winner .material-icons {
  color: #ffd700;
  font-size: 20px;
}

.winner-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
}

.winner-name {
  color: #ffd700;
  font-weight: 700;
  font-size: 1.1rem;
}

.winners-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.winner-score {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  margin-left: auto;
}

.match-results-enhanced {
  display: grid;
  gap: 8px;
}

.match-result-enhanced {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  transition: background 0.2s ease;
}

.match-result-enhanced:hover {
  background: rgba(255, 255, 255, 0.06);
}

.result-position {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.result-position.position-1 {
  background: #ffd700;
  color: #333;
}

.result-position.position-2 {
  background: #c0c0c0;
  color: #333;
}

.result-position.position-3 {
  background: #cd7f32;
  color: white;
}

.result-position.position-4,
.result-position.position-5,
.result-position.position-6 {
  background: #6c757d;
  color: white;
}

.result-player {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.result-player .player-name {
  font-weight: 600;
  color: #fff;
}

.player-performance {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
}

.result-points {
  color: #28a745;
  font-weight: 600;
  font-size: 0.9rem;
}

.more-players {
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
  font-style: italic;
  padding: 8px;
}

/* Floating Add Button */
.floating-add-btn {
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 60px;
  height: 60px;
  background: linear-gradient(45deg, #ff6b35, #f7931e);
  color: white;
  border: none;
  border-radius: 50%;
  box-shadow: 0 4px 20px rgba(255, 107, 53, 0.4);
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.floating-add-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 25px rgba(255, 107, 53, 0.6);
}

.floating-add-btn .material-icons {
  font-size: 28px;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
  box-sizing: border-box;
}

.modal-content {
  background: #2d2d2d;
  border-radius: 16px;
  border: 1px solid rgba(255, 107, 53, 0.3);
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-title {
  color: #ff6b35;
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.modal-close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.modal-body {
  padding: 24px;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 20px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

/* Modal Player Entries */
.match-players-modal {
  display: grid;
  gap: 12px;
  margin-bottom: 24px;
}

.modal-player-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  transition: all 0.3s ease;
}

.modal-player-entry:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 107, 53, 0.3);
}

.player-info-modal {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.player-name-modal {
  font-weight: 700;
  font-size: 1.1rem;
  color: #fff;
}

.player-current-stats {
  display: flex;
  gap: 12px;
  font-size: 0.85rem;
}

.current-points {
  color: #ff6b35;
  font-weight: 600;
}

.current-wins {
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

.wins-input-modal {
  width: 70px;
  padding: 8px 12px;
  border: 2px solid rgba(255, 107, 53, 0.3);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
  transition: all 0.3s ease;
}

.wins-input-modal:focus {
  outline: none;
  border-color: #ff6b35;
  background: rgba(255, 255, 255, 0.15);
  box-shadow: 0 0 10px rgba(255, 107, 53, 0.3);
}

/* Modal Match Preview */
.match-preview-modal {
  background: rgba(40, 167, 69, 0.1);
  border: 1px solid rgba(40, 167, 69, 0.3);
  border-radius: 10px;
  padding: 20px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.preview-header h3 {
  margin: 0;
  color: #28a745;
  font-size: 1.2rem;
  font-weight: 600;
}

.participants-count {
  background: rgba(40, 167, 69, 0.2);
  color: #28a745;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.preview-results {
  display: grid;
  gap: 10px;
}

.preview-result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  transition: background 0.2s ease;
}

.preview-result:hover {
  background: rgba(255, 255, 255, 0.08);
}

.result-position-modal {
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

.result-position-modal.position-1 {
  background: #ffd700;
  color: #333;
}

.result-position-modal.position-2 {
  background: #c0c0c0;
  color: #333;
}

.result-position-modal.position-3 {
  background: #cd7f32;
  color: white;
}

.result-position-modal.position-4,
.result-position-modal.position-5,
.result-position-modal.position-6 {
  background: #6c757d;
  color: white;
}

.result-info-modal {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.player-name-result {
  font-weight: 600;
  color: #fff;
  font-size: 1rem;
}

.wins-count-result {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
}

.points-earned-modal {
  color: #28a745;
  font-weight: 700;
  font-size: 1.1rem;
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

/* Global Statistics */
.global-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.global-stat-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 107, 53, 0.2);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.global-stat-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 107, 53, 0.4);
  box-shadow: 0 2px 10px rgba(255, 107, 53, 0.1);
}

.global-stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 107, 53, 0.2);
  border-radius: 8px;
  flex-shrink: 0;
}

.global-stat-icon .material-icons {
  color: #ff6b35;
  font-size: 18px;
}

.global-stat-content {
  flex: 1;
  min-width: 0;
}

.global-stat-number {
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff;
  line-height: 1;
  margin-bottom: 2px;
}

.global-stat-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
  line-height: 1;
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

  /* Enhanced Recent Matches Mobile */
  .match-card-enhanced {
    padding: 15px;
  }

  .match-header-enhanced {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .match-date-info {
    justify-content: center;
  }

  .match-participants {
    justify-content: center;
  }

  .match-winner {
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    text-align: center;
  }

  .winner-score {
    margin-left: 0;
  }

  .match-results-enhanced {
    gap: 10px;
  }

  .match-result-enhanced {
    padding: 10px;
  }

  .result-player {
    gap: 4px;
  }

  /* Enhanced Match History Mobile */
  .match-card-history {
    padding: 15px;
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
  .season-info-display {
    padding: 20px;
  }

  .season-header-info {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
    text-align: center;
  }

  .season-title-info {
    align-items: center;
  }

  .season-name-display {
    font-size: 1.5rem;
  }

  .season-date-info {
    justify-content: center;
  }

  .date-range {
    text-align: center;
  }

  .season-stats-grid {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .stat-card {
    padding: 12px;
    gap: 10px;
  }

  .stat-icon {
    width: 35px;
    height: 35px;
  }

  .stat-icon .material-icons {
    font-size: 18px;
  }

  .stat-number {
    font-size: 1.4rem;
  }

  .stat-label {
    font-size: 0.8rem;
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

  /* Global Statistics Mobile */
  .global-stats {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .global-stat-item {
    padding: 10px;
    gap: 8px;
  }

  .global-stat-icon {
    width: 30px;
    height: 30px;
  }

  .global-stat-icon .material-icons {
    font-size: 16px;
  }

  .global-stat-number {
    font-size: 1.2rem;
  }

  .global-stat-label {
    font-size: 0.7rem;
  }

  /* Modal Mobile Styles */
  .floating-add-btn {
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
  }

  .floating-add-btn .material-icons {
    font-size: 24px;
  }

  .modal-overlay {
    padding: 10px;
  }

  .modal-content {
    max-height: 95vh;
    border-radius: 12px;
  }

  .modal-header {
    padding: 16px 20px;
  }

  .modal-title {
    font-size: 1.3rem;
  }

  .modal-body {
    padding: 20px;
  }

  .modal-footer {
    padding: 16px 20px;
    flex-direction: column;
    gap: 10px;
  }

  .modal-player-entry {
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    text-align: center;
  }

  .player-info-modal {
    align-items: center;
  }

  .wins-input-container {
    justify-content: center;
  }

  .wins-input-modal {
    width: 60px;
    font-size: 0.9rem;
  }

  .match-preview-modal {
    padding: 15px;
  }

  .preview-header {
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }

  .preview-results {
    gap: 8px;
  }

  .preview-result {
    padding: 10px;
  }

  /* Детальная статистика игроков - мобильные стили */
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
  background: rgba(255, 107, 53, 0.08);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
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
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #ff6b35;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  position: relative;
}

.podium-avatar.champion {
  width: 70px;
  height: 70px;
  background: #ffd700;
}

.podium-avatar .material-icons {
  font-size: 30px;
  color: white;
}

.podium-avatar.champion .material-icons {
  font-size: 35px;
  color: #333;
}

.podium-medal {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.podium-medal.gold {
  background: #ffd700;
  color: #333;
}

.podium-medal.silver {
  background: #c0c0c0;
  color: #333;
}

.podium-medal.bronze {
  background: #cd7f32;
  color: white;
}

.podium-medal.default {
  background: #6c757d;
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
  gap: 2px;
  text-align: center;
}

.podium-stats .stat {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.2;
}

.podium-base {
  width: 100px;
  border-radius: 8px 8px 0 0;
  position: relative;
}

.podium-base-1 {
  height: 80px;
  background: #ffd700;
}

.podium-base-2 {
  height: 60px;
  background: #c0c0c0;
}

.podium-base-3 {
  height: 50px;
  background: #cd7f32;
}

/* Default podium base for ranks 4+ */
.podium-base-4,
.podium-base-5,
.podium-base-6 {
  height: 40px;
  background: #6c757d;
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
  padding: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 107, 53, 0.3);
  border-radius: 8px;
  transition: background-color 0.2s ease;
  position: relative;
}

.leaderboard-item-enhanced:hover {
  background: rgba(255, 255, 255, 0.08);
}

.leaderboard-item-enhanced.top-three {
  border-width: 2px;
}

.player-rank {
  margin-right: 20px;
}

.rank-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
}

.rank-circle.gold {
  background: #ffd700;
  color: #333;
}

.rank-circle.silver {
  background: #c0c0c0;
  color: #333;
}

.rank-circle.bronze {
  background: #cd7f32;
  color: white;
}

.rank-circle.default {
  background: #6c757d;
  color: white;
}

.player-avatar-small {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #ff6b35;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
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

.stat-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 400;
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