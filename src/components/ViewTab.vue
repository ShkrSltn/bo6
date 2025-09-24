<script setup lang="ts">
import { computed } from 'vue'
import type { Season, DatabasePlayer } from '@/lib/supabase'

// Props
const props = defineProps<{
  currentSeason: Season | null
  seasons: Season[]
  globalPlayers: DatabasePlayer[]
  currentSeasonId: number | null
}>()

// Emits
const emit = defineEmits<{
  openAddMatchModal: []
  switchTab: [tab: 'view' | 'season' | 'players']
}>()

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

// Computed global wins ranking
const globalWinsRanking = computed(() => {
  const playerStatsMap = new Map<number, {
    name: string;
    totalMatchWins: number;
    totalMatchVictories: number;
    seasonWins: number;
    seasonsParticipated: number;
    totalPoints: number;
  }>()

  props.seasons.forEach(season => {
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

      const matchVictories = season.matches.reduce((total, match) => {
        const playerInMatch = match.players.find(p => p.playerId === player.playerId)
        return total + (playerInMatch?.winsInMatch || 0)
      }, 0)

      if (existing) {
        existing.totalMatchWins += player.wins
        existing.totalMatchVictories += matchVictories
        existing.totalPoints += player.points
        if (isSeasonWinner) existing.seasonWins += 1
        existing.seasonsParticipated += 1
      } else {
        playerStatsMap.set(player.playerId, {
          name: player.name,
          totalMatchWins: player.wins,
          totalMatchVictories: matchVictories,
          totalPoints: player.points,
          seasonWins: isSeasonWinner ? 1 : 0,
          seasonsParticipated: 1
        })
      }
    })
  })

  return Array.from(playerStatsMap.entries())
    .map(([playerId, data]) => ({
      playerId,
      name: data.name,
      totalMatchWins: data.totalMatchWins,
      totalMatchVictories: data.totalMatchVictories,
      totalPoints: data.totalPoints,
      seasonWins: data.seasonWins,
      seasonsParticipated: data.seasonsParticipated
    }))
    .sort((a, b) => {
      if (b.seasonWins !== a.seasonWins) return b.seasonWins - a.seasonWins
      if (b.totalMatchWins !== a.totalMatchWins) return b.totalMatchWins - a.totalMatchWins
      if (b.totalMatchVictories !== a.totalMatchVictories) return b.totalMatchVictories - a.totalMatchVictories
      return a.name.localeCompare(b.name)
    })
})

// Get player name by playerId
const getPlayerName = (playerId: number): string => {
  return players.value.find(p => p.playerId === playerId)?.name || 'Unknown'
}

// Get season match wins for player
const getSeasonMatchWinsForPlayer = (playerId: number, seasonId: number) => {
  const season = props.seasons.find(s => s.id === seasonId)
  if (!season) return 0

  return season.matches.reduce((total, match) => {
    const playerInMatch = match.players.find(p => p.playerId === playerId)
    return total + (playerInMatch?.winsInMatch || 0)
  }, 0)
}

// Helper functions for leaderboard
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
</script>

<template>
  <div class="view-mode">
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
    <button v-if="currentSeason && players.length > 0" @click="emit('openAddMatchModal')" class="floating-add-btn"
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
                    {{ player.seasonWins }} чемпионств
                  </div>
                  <div class="wins-count">
                    <span class="material-icons">military_tech</span>
                    {{ player.totalMatchWins }} побед дня
                  </div>
                  <div class="wins-count">
                    <span class="material-icons">trending_up</span>
                    {{ player.totalMatchVictories }} матчей
                  </div>
                  <div class="wins-count">
                    <span class="material-icons">star</span>
                    {{ player.totalPoints }} очков
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
        <button @click="emit('switchTab', 'season')" class="btn btn-primary">
          <span class="material-icons">sports</span>
          Перейти к управлению сезонами
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* View Mode Styles */
.view-mode {
  animation: fadeIn 0.3s ease-in;
}

/* Season Info Display */
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

/* Main Layout */
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

/* Recent Matches */
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
  position: relative;
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

.controls {
  text-align: center;
}

.empty-state {
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  padding: 40px;
  font-style: italic;
}

/* Responsive Design for View Tab */
@media (max-width: 768px) {
  .main-layout {
    flex-direction: column;
    gap: 20px;
  }

  .sidebar {
    width: 100%;
    order: -1;
  }

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

  .floating-add-btn {
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
  }

  .floating-add-btn .material-icons {
    font-size: 24px;
  }

  .champion-badge {
    right: -6px;
    top: -6px;
    width: 20px;
    height: 20px;
  }

  .champion-badge .material-icons {
    font-size: 12px;
  }
}
</style>
