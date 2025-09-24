<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { scoreboardServiceV2 as scoreboardService } from '@/services/scoreboardServiceV2'
import type { Player, Match, Season, DatabasePlayer } from '@/lib/supabase'
import ViewTab from '@/components/ViewTab.vue'
import SeasonTab from '@/components/SeasonTab.vue'
import PlayersTab from '@/components/PlayersTab.vue'
import RulesTab from '@/components/RulesTab.vue'

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
const activeTab = ref<'view' | 'season' | 'players' | 'rules'>('view')

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
const createNewSeason = async (name: string, selectedPlayers: number[]) => {
  if (!name.trim() || isLoading.value) return

  isLoading.value = true
  try {
    const newSeason = await scoreboardService.createSeason(name.trim(), selectedPlayers)
    if (newSeason) {
      await loadSeasons()
      currentSeasonId.value = newSeason.id
    }
  } catch (error) {
    console.error('Error creating season:', error)
  } finally {
    isLoading.value = false
  }
}

// Match saving wrapper for component
const saveMatchFromTab = async (matchPlayers: { playerId: number; winsInMatch: number; position: number; pointsEarned: number }[]) => {
  if (!currentSeason.value || isLoading.value) return

  isLoading.value = true
  try {
    const savedMatch = await scoreboardService.saveMatch(currentSeason.value.id, matchPlayers)
    if (savedMatch) {
      await loadSeasons()
    }
  } catch (error) {
    console.error('Error saving match:', error)
  } finally {
    isLoading.value = false
  }
}

// Player name update wrapper
const updatePlayerName = async (playerId: number, name: string) => {
  if (isLoading.value) return

  isLoading.value = true
  try {
    const success = await scoreboardService.updatePlayerName(playerId, name)
    if (success) {
      await loadSeasons()
    }
  } catch (error) {
    console.error('Error updating player:', error)
  } finally {
    isLoading.value = false
  }
}

// Season name update wrapper
const updateSeasonName = async (seasonId: number, name: string) => {
  if (isLoading.value) return

  isLoading.value = true
  try {
    const success = await scoreboardService.updateSeasonName(seasonId, name)
    if (success) {
      await loadSeasons()
    }
  } catch (error) {
    console.error('Error updating season:', error)
  } finally {
    isLoading.value = false
  }
}

// Match update wrapper
const updateMatch = async (matchId: number, matchPlayers: { playerId: number; winsInMatch: number; position: number; pointsEarned: number }[]) => {
  if (isLoading.value) return

  isLoading.value = true
  try {
    const success = await scoreboardService.updateMatch(matchId, matchPlayers)
    if (success) {
      await loadSeasons()
    }
  } catch (error) {
    console.error('Error updating match:', error)
  } finally {
    isLoading.value = false
  }
}

// Global player name update wrapper
const updateGlobalPlayerName = async (playerId: number, name: string) => {
  if (isLoading.value) return

  isLoading.value = true
  try {
    const success = await scoreboardService.updateGlobalPlayerName(playerId, name)
    if (success) {
      await loadGlobalPlayers()
      await loadSeasons()
    }
  } catch (error) {
    console.error('Error updating global player name:', error)
  } finally {
    isLoading.value = false
  }
}

// Delete global player wrapper
const deleteGlobalPlayerConfirm = async (playerId: number) => {
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

// Enhanced delete function with confirmation
const deleteGlobalPlayerEnhanced = async (playerId: number) => {
  const player = globalPlayers.value.find(p => p.id === playerId)
  if (!player) return

  const participatingSeasons = getSeasonsForPlayer(playerId)
  let confirmMessage = `Вы уверены, что хотите удалить игрока "${player.name}"?`

  if (participatingSeasons.length > 0) {
    confirmMessage += `\n\nВнимание: Игрок участвует в ${participatingSeasons.length} сезонах. Вся его статистика будет удалена!`
  }

  if (confirm(confirmMessage)) {
    await deleteGlobalPlayerConfirm(playerId)
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
const switchTab = (tab: 'view' | 'season' | 'players' | 'rules') => {
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
        <button @click="switchTab('rules')" class="tab-btn" :class="{ active: activeTab === 'rules' }">
          <span class="material-icons">rule</span>
          Правила
        </button>
      </div>
    </header>

    <div class="container">
      <!-- VIEW MODE -->
      <ViewTab 
        v-if="activeTab === 'view'"
        :current-season="currentSeason"
        :seasons="seasons"
        :global-players="globalPlayers"
        :current-season-id="currentSeasonId"
        @open-add-match-modal="openAddMatchModal"
        @switch-tab="switchTab"
      />

      <!-- SEASON MANAGEMENT MODE -->
      <SeasonTab
        v-else-if="activeTab === 'season'"
        :seasons="seasons"
        :global-players="globalPlayers"
        :current-season="currentSeason"
        :current-season-id="currentSeasonId"
        :is-loading="isLoading"
        @create-season="createNewSeason"
        @close-season="closeSeason"
        @switch-to-season="switchToSeason"
        @delete-season="deleteSeason"
        @add-player-to-season="addPlayerToSeason"
        @remove-player-from-season="removePlayerFromSeason"
        @save-match="saveMatchFromTab"
        @update-player-name="updatePlayerName"
        @update-season-name="updateSeasonName"
        @update-match="updateMatch"
        @delete-match="deleteMatch"
      />

      <!-- PLAYERS MANAGEMENT MODE -->
      <PlayersTab
        v-else-if="activeTab === 'players'"
        :global-players="globalPlayers"
        :seasons="seasons"
        :is-loading="isLoading"
        @create-global-player="createGlobalPlayer"
        @update-global-player-name="updateGlobalPlayerName"
        @delete-global-player="deleteGlobalPlayerEnhanced"
      />

      <!-- RULES MODE -->
      <RulesTab
        v-else-if="activeTab === 'rules'"
      />
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

<style>
/* Global App Styles */
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

/* Common Input Styles */
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

/* Common Button Styles */
.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
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

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
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

.btn .material-icons {
  font-size: 18px;
}

.section-title .material-icons {
  font-size: 1.2em;
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

.wins-input-container {
  display: flex;
  align-items: center;
  gap: 8px;
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

.wins-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
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

/* Responsive Design */
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
}

/* Animation */
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
</style>