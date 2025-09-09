import { supabase } from '../lib/supabase'
import type {
  DatabaseSeason,
  DatabasePlayer,
  DatabaseSeasonPlayer,
  DatabaseMatch,
  DatabaseMatchPlayer,
  Season,
  Player,
  Match,
  MatchPlayer,
} from '../lib/supabase'

class ScoreboardServiceV2 {
  // === SEASONS ===

  async getAllSeasons(): Promise<Season[]> {
    try {
      const { data: seasonsData, error: seasonsError } = await supabase
        .from('seasons')
        .select('*')
        .order('created_at', { ascending: false })

      if (seasonsError) throw seasonsError

      const seasons: Season[] = []

      for (const season of seasonsData || []) {
        // Получаем игроков сезона с их именами
        const { data: seasonPlayersData, error: playersError } = await supabase
          .from('season_players')
          .select(
            `
            *,
            players:player_id (
              id,
              name
            )
          `,
          )
          .eq('season_id', season.id)

        if (playersError) throw playersError

        // Получаем матчи сезона
        const { data: matchesData, error: matchesError } = await supabase
          .from('matches')
          .select(
            `
            *,
            match_players (
              player_id,
              position,
              points_earned
            )
          `,
          )
          .eq('season_id', season.id)
          .order('date', { ascending: false })

        if (matchesError) throw matchesError

        // Форматируем игроков
        const players: Player[] = (seasonPlayersData || []).map((sp: any) => ({
          id: sp.id,
          playerId: sp.player_id,
          name: sp.players?.name || 'Unknown',
          wins: sp.wins,
          points: sp.points,
        }))

        // Форматируем матчи
        const matches: Match[] = (matchesData || []).map((match: any) => ({
          id: match.id,
          seasonId: match.season_id,
          date: new Date(match.date).toLocaleDateString('ru-RU'),
          players: match.match_players.map((mp: any) => ({
            playerId: mp.player_id,
            position: mp.position,
            pointsEarned: mp.points_earned,
          })),
        }))

        seasons.push({
          id: season.id,
          name: season.name,
          startDate: new Date(season.start_date).toLocaleDateString('ru-RU'),
          endDate: season.end_date
            ? new Date(season.end_date).toLocaleDateString('ru-RU')
            : undefined,
          isActive: season.is_active,
          players,
          matches,
        })
      }

      return seasons
    } catch (error) {
      console.error('Error fetching seasons:', error)
      throw error
    }
  }

  async createSeason(name: string, selectedPlayerIds: number[]): Promise<Season | null> {
    try {
      // Создаем сезон
      const { data: seasonData, error: seasonError } = await supabase
        .from('seasons')
        .insert([
          {
            name,
            is_active: true,
          },
        ])
        .select()
        .single()

      if (seasonError) throw seasonError

      // Добавляем выбранных игроков в сезон
      if (selectedPlayerIds.length > 0) {
        const seasonPlayerInserts = selectedPlayerIds.map((playerId) => ({
          season_id: seasonData.id,
          player_id: playerId,
          wins: 0,
          points: 0,
        }))

        const { error: playersError } = await supabase
          .from('season_players')
          .insert(seasonPlayerInserts)

        if (playersError) throw playersError
      }

      // Возвращаем созданный сезон
      const seasons = await this.getAllSeasons()
      return seasons.find((s) => s.id === seasonData.id) || null
    } catch (error) {
      console.error('Error creating season:', error)
      throw error
    }
  }

  async closeSeason(seasonId: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('seasons')
        .update({
          is_active: false,
          end_date: new Date().toISOString(),
        })
        .eq('id', seasonId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error closing season:', error)
      return false
    }
  }

  async deleteSeason(seasonId: number): Promise<boolean> {
    try {
      const { error } = await supabase.from('seasons').delete().eq('id', seasonId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting season:', error)
      return false
    }
  }

  async updateSeasonName(seasonId: number, name: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('seasons').update({ name }).eq('id', seasonId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error updating season name:', error)
      return false
    }
  }

  // === GLOBAL PLAYERS ===

  async getAllGlobalPlayers(): Promise<DatabasePlayer[]> {
    try {
      const { data, error } = await supabase.from('players').select('*').order('name')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching global players:', error)
      throw error
    }
  }

  async createGlobalPlayer(name: string): Promise<DatabasePlayer | null> {
    try {
      const { data, error } = await supabase.from('players').insert([{ name }]).select().single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating global player:', error)
      throw error
    }
  }

  async updateGlobalPlayerName(playerId: number, name: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('players').update({ name }).eq('id', playerId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error updating global player name:', error)
      return false
    }
  }

  async deleteGlobalPlayer(playerId: number): Promise<boolean> {
    try {
      const { error } = await supabase.from('players').delete().eq('id', playerId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting global player:', error)
      return false
    }
  }

  // Legacy method for backward compatibility
  async updatePlayerName(seasonPlayerId: number, name: string): Promise<boolean> {
    try {
      // Find the global player ID
      const { data: seasonPlayer, error: fetchError } = await supabase
        .from('season_players')
        .select('player_id')
        .eq('id', seasonPlayerId)
        .single()

      if (fetchError) throw fetchError

      // Update the global player name
      return await this.updateGlobalPlayerName(seasonPlayer.player_id, name)
    } catch (error) {
      console.error('Error updating player name:', error)
      return false
    }
  }

  async updateMatch(matchId: number, players: MatchPlayer[]): Promise<boolean> {
    try {
      // Update match players
      const { error: deleteError } = await supabase
        .from('match_players')
        .delete()
        .eq('match_id', matchId)

      if (deleteError) throw deleteError

      const matchPlayerInserts = players.map((mp) => ({
        match_id: matchId,
        player_id: mp.playerId,
        position: mp.position,
        points_earned: this.calculatePoints(mp.position, players),
      }))

      const { error: insertError } = await supabase.from('match_players').insert(matchPlayerInserts)

      if (insertError) throw insertError

      // Get season ID and recalculate stats
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('season_id')
        .eq('id', matchId)
        .single()

      if (matchError) throw matchError

      // Recalculate stats for all affected players
      for (const mp of players) {
        await this.recalculatePlayerStats(matchData.season_id, mp.playerId)
      }

      return true
    } catch (error) {
      console.error('Error updating match:', error)
      return false
    }
  }

  // === SEASON PLAYERS ===

  async addPlayerToSeason(seasonId: number, playerId: number): Promise<Player | null> {
    try {
      const { data, error } = await supabase
        .from('season_players')
        .insert([
          {
            season_id: seasonId,
            player_id: playerId,
            wins: 0,
            points: 0,
          },
        ])
        .select(
          `
          *,
          players:player_id (
            id,
            name
          )
        `,
        )
        .single()

      if (error) throw error

      return {
        id: data.id,
        playerId: data.player_id,
        name: (data as any).players?.name || 'Unknown',
        wins: data.wins,
        points: data.points,
      }
    } catch (error) {
      console.error('Error adding player to season:', error)
      throw error
    }
  }

  async removePlayerFromSeason(seasonId: number, playerId: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('season_players')
        .delete()
        .eq('season_id', seasonId)
        .eq('player_id', playerId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error removing player from season:', error)
      return false
    }
  }

  // === MATCHES ===

  async saveMatch(seasonId: number, matchPlayers: MatchPlayer[]): Promise<Match | null> {
    try {
      // Создаем матч
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .insert([
          {
            season_id: seasonId,
            date: new Date().toISOString(),
          },
        ])
        .select()
        .single()

      if (matchError) throw matchError

      // Добавляем игроков матча
      const matchPlayerInserts = matchPlayers.map((mp) => ({
        match_id: matchData.id,
        player_id: mp.playerId,
        position: mp.position,
        points_earned: this.calculatePoints(mp.position, matchPlayers),
      }))

      const { error: playersError } = await supabase
        .from('match_players')
        .insert(matchPlayerInserts)

      if (playersError) throw playersError

      // Обновляем статистику игроков
      for (const mp of matchPlayers) {
        await this.updatePlayerStats(seasonId, mp.playerId, matchPlayers)
      }

      return {
        id: matchData.id,
        seasonId: matchData.season_id,
        date: new Date(matchData.date).toLocaleDateString('ru-RU'),
        players: matchPlayers.map((mp) => ({
          ...mp,
          pointsEarned: this.calculatePoints(mp.position, matchPlayers),
        })),
      }
    } catch (error) {
      console.error('Error saving match:', error)
      throw error
    }
  }

  async deleteMatch(matchId: number): Promise<boolean> {
    try {
      // Получаем данные матча перед удалением
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select(
          `
          *,
          match_players (
            player_id,
            position
          )
        `,
        )
        .eq('id', matchId)
        .single()

      if (matchError) throw matchError

      // Удаляем матч (match_players удалятся автоматически по CASCADE)
      const { error: deleteError } = await supabase.from('matches').delete().eq('id', matchId)

      if (deleteError) throw deleteError

      // Пересчитываем статистику игроков
      for (const mp of matchData.match_players) {
        await this.recalculatePlayerStats(matchData.season_id, mp.player_id)
      }

      return true
    } catch (error) {
      console.error('Error deleting match:', error)
      return false
    }
  }

  // === HELPER METHODS ===

  calculatePoints(position: number, allPlayers: MatchPlayer[]): number {
    const playerCount = allPlayers.length
    const firstPlaceCount = allPlayers.filter((p) => p.position === 1).length
    const secondPlaceCount = allPlayers.filter((p) => p.position === 2).length

    if (position === 1) {
      if (firstPlaceCount > 1) {
        // Деление первого места
        const totalPoints = 3 + 1 // 3 за первое + 1 за второе
        return totalPoints / firstPlaceCount
      }
      return 3
    } else if (position === 2) {
      if (firstPlaceCount > 1) {
        // Если первое место поделено, второе место не получает очков
        return 0
      }
      if (secondPlaceCount > 1) {
        // Деление второго места
        return 1 / secondPlaceCount
      }
      return 1
    }
    return 0
  }

  private async updatePlayerStats(
    seasonId: number,
    playerId: number,
    matchPlayers: MatchPlayer[],
  ): Promise<void> {
    try {
      const playerResult = matchPlayers.find((p) => p.playerId === playerId)
      if (!playerResult) return

      const isWin = playerResult.position === 1
      const pointsEarned = this.calculatePoints(playerResult.position, matchPlayers)

      // Получаем текущую статистику
      const { data: currentStats, error: fetchError } = await supabase
        .from('season_players')
        .select('wins, points')
        .eq('season_id', seasonId)
        .eq('player_id', playerId)
        .single()

      if (fetchError) throw fetchError

      // Обновляем статистику
      const { error: updateError } = await supabase
        .from('season_players')
        .update({
          wins: currentStats.wins + (isWin ? 1 : 0),
          points: Number((currentStats.points + pointsEarned).toFixed(2)),
        })
        .eq('season_id', seasonId)
        .eq('player_id', playerId)

      if (updateError) throw updateError
    } catch (error) {
      console.error('Error updating player stats:', error)
      throw error
    }
  }

  private async recalculatePlayerStats(seasonId: number, playerId: number): Promise<void> {
    try {
      // Получаем все матчи игрока в сезоне
      const { data: matches, error: matchesError } = await supabase
        .from('match_players')
        .select(
          `
          position,
          matches!inner (
            id,
            season_id,
            match_players (
              player_id,
              position
            )
          )
        `,
        )
        .eq('player_id', playerId)
        .eq('matches.season_id', seasonId)

      if (matchesError) throw matchesError

      let totalWins = 0
      let totalPoints = 0

      for (const match of matches || []) {
        const allPlayersInMatch = (match as any).matches.match_players.map((mp: any) => ({
          playerId: mp.player_id,
          position: mp.position,
        }))

        if (match.position === 1) {
          totalWins++
        }

        totalPoints += this.calculatePoints(match.position, allPlayersInMatch)
      }

      // Обновляем статистику
      const { error: updateError } = await supabase
        .from('season_players')
        .update({
          wins: totalWins,
          points: Number(totalPoints.toFixed(2)),
        })
        .eq('season_id', seasonId)
        .eq('player_id', playerId)

      if (updateError) throw updateError
    } catch (error) {
      console.error('Error recalculating player stats:', error)
      throw error
    }
  }

  async clearAllData(): Promise<boolean> {
    try {
      // Удаляем в правильном порядке из-за внешних ключей
      await supabase.from('match_players').delete().neq('id', 0)
      await supabase.from('matches').delete().neq('id', 0)
      await supabase.from('season_players').delete().neq('id', 0)
      await supabase.from('seasons').delete().neq('id', 0)
      await supabase.from('players').delete().neq('id', 0)

      return true
    } catch (error) {
      console.error('Error clearing all data:', error)
      return false
    }
  }
}

export const scoreboardServiceV2 = new ScoreboardServiceV2()
