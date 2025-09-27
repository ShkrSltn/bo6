import { supabase } from '@/lib/supabase'
import type {
  DatabaseSeason,
  DatabasePlayer,
  DatabaseMatch,
  DatabaseMatchPlayer,
} from '@/lib/supabase'

// Интерфейсы для приложения (соответствуют App.vue)
export interface Player {
  id: number
  name: string
  wins: number
  points: number
}

export interface Match {
  id: number
  date: string
  players: { playerId: number; position: number }[]
}

export interface Season {
  id: number
  name: string
  startDate: string
  endDate?: string
  isActive: boolean
  players: Player[]
  matches: Match[]
}

class ScoreboardService {
  // Сезоны
  async getAllSeasons(): Promise<Season[]> {
    const { data: seasonsData, error: seasonsError } = await supabase
      .from('seasons')
      .select('*')
      .order('created_at', { ascending: false })

    if (seasonsError) {
      console.error('Error fetching seasons:', seasonsError)
      return []
    }

    const seasons: Season[] = []

    for (const seasonData of seasonsData) {
      const season = await this.getSeasonWithData(seasonData)
      seasons.push(season)
    }

    return seasons
  }

  async getSeasonWithData(seasonData: DatabaseSeason): Promise<Season> {
    // Получаем игроков сезона
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('season_id', seasonData.id)

    if (playersError) {
      console.error('Error fetching players:', playersError)
    }

    // Получаем матчи сезона
    const { data: matchesData, error: matchesError } = await supabase
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
      .eq('season_id', seasonData.id)
      .order('created_at', { ascending: false })

    if (matchesError) {
      console.error('Error fetching matches:', matchesError)
    }

    const players: Player[] = (playersData || []).map((p) => ({
      id: p.id,
      name: p.name,
      wins: p.wins,
      points: Number(p.points),
    }))

    const matches: Match[] = (matchesData || []).map((m) => ({
      id: m.id,
      date: new Date(m.date).toLocaleString('ru-RU'),
      players: m.match_players.map((mp: any) => ({
        playerId: mp.player_id,
        position: mp.position,
      })),
    }))

    return {
      id: seasonData.id,
      name: seasonData.name,
      startDate: new Date(seasonData.start_date).toLocaleString('ru-RU'),
      endDate: seasonData.end_date
        ? new Date(seasonData.end_date).toLocaleString('ru-RU')
        : undefined,
      isActive: seasonData.is_active,
      players,
      matches,
    }
  }

  async createSeason(name: string): Promise<Season | null> {
    // Сначала делаем все существующие сезоны неактивными
    await supabase.from('seasons').update({ is_active: false }).eq('is_active', true)

    const { data, error } = await supabase
      .from('seasons')
      .insert({
        name,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating season:', error)
      return null
    }

    return this.getSeasonWithData(data)
  }

  async closeSeason(seasonId: number): Promise<boolean> {
    const { error } = await supabase
      .from('seasons')
      .update({
        is_active: false,
        end_date: new Date().toISOString(),
      })
      .eq('id', seasonId)

    if (error) {
      console.error('Error closing season:', error)
      return false
    }

    return true
  }

  async deleteSeason(seasonId: number): Promise<boolean> {
    const { error } = await supabase.from('seasons').delete().eq('id', seasonId)

    if (error) {
      console.error('Error deleting season:', error)
      return false
    }

    return true
  }

  // Игроки
  async addPlayer(seasonId: number, name: string): Promise<Player | null> {
    const { data, error } = await supabase
      .from('players')
      .insert({
        season_id: seasonId,
        name,
        wins: 0,
        points: 0,
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding player:', error)
      return null
    }

    return {
      id: data.id,
      name: data.name,
      wins: data.wins,
      points: Number(data.points),
    }
  }

  async removePlayer(playerId: number): Promise<boolean> {
    const { error } = await supabase.from('players').delete().eq('id', playerId)

    if (error) {
      console.error('Error removing player:', error)
      return false
    }

    return true
  }

  async updatePlayerStats(playerId: number, wins: number, points: number): Promise<boolean> {
    const { error } = await supabase
      .from('players')
      .update({
        wins,
        points,
      })
      .eq('id', playerId)

    if (error) {
      console.error('Error updating player stats:', error)
      return false
    }

    return true
  }

  // Матчи
  async saveMatch(
    seasonId: number,
    matchPlayers: { playerId: number; position: number }[],
  ): Promise<Match | null> {
    // Создаем матч
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .insert({
        season_id: seasonId,
        date: new Date().toISOString(),
      })
      .select()
      .single()

    if (matchError) {
      console.error('Error creating match:', matchError)
      return null
    }

    // Функция для вычисления очков
    const calculatePoints = (
      position: number,
      players: { playerId: number; position: number }[],
    ): number => {
      const playersAtPosition = players.filter((p) => p.position === position).length

      if (position === 1) {
        if (playersAtPosition === 1) return 3 // Single 1st place
        if (playersAtPosition === 2) return 2.5 // Two 1st places
        return 2 // Three or more 1st places
      }

      if (position === 2) {
        if (playersAtPosition === 1) return 1 // Single 2nd place
        if (playersAtPosition === 2) return 1.5 // Two 2nd places
        return 0 // Three or more 2nd places
      }

      return 0 // 3rd place and below
    }

    // Создаем записи результатов матча
    const matchPlayerInserts = matchPlayers.map((mp) => ({
      match_id: matchData.id,
      player_id: mp.playerId,
      position: mp.position,
      points_earned: calculatePoints(mp.position, matchPlayers),
    }))

    const { error: matchPlayersError } = await supabase
      .from('match_players')
      .insert(matchPlayerInserts)

    if (matchPlayersError) {
      console.error('Error saving match players:', matchPlayersError)
      return null
    }

    // Обновляем статистику игроков
    for (const mp of matchPlayers) {
      const { data: playerData, error: playerFetchError } = await supabase
        .from('players')
        .select('wins, points')
        .eq('id', mp.playerId)
        .single()

      if (playerFetchError) {
        console.error('Error fetching player:', playerFetchError)
        continue
      }

      const newWins = mp.position === 1 ? playerData.wins + 1 : playerData.wins
      const newPoints = Number(playerData.points) + calculatePoints(mp.position, matchPlayers)

      await this.updatePlayerStats(mp.playerId, newWins, newPoints)
    }

    return {
      id: matchData.id,
      date: new Date(matchData.date).toLocaleString('ru-RU'),
      players: matchPlayers,
    }
  }

  // Удаление матча
  async deleteMatch(matchId: number): Promise<boolean> {
    try {
      // Сначала получаем данные матча для пересчета статистики
      const { data: matchData, error: matchError } = await supabase
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
        .eq('id', matchId)
        .single()

      if (matchError) {
        console.error('Error fetching match for deletion:', matchError)
        return false
      }

      // Пересчитываем статистику игроков (вычитаем очки и победы)
      for (const mp of matchData.match_players) {
        const { data: playerData, error: playerFetchError } = await supabase
          .from('players')
          .select('wins, points')
          .eq('id', mp.player_id)
          .single()

        if (playerFetchError) {
          console.error('Error fetching player for stat update:', playerFetchError)
          continue
        }

        const newWins = mp.position === 1 ? Math.max(0, playerData.wins - 1) : playerData.wins
        const newPoints = Math.max(0, Number(playerData.points) - mp.points_earned)

        await this.updatePlayerStats(mp.player_id, newWins, newPoints)
      }

      // Удаляем матч (match_players удалятся каскадно)
      const { error: deleteError } = await supabase.from('matches').delete().eq('id', matchId)

      if (deleteError) {
        console.error('Error deleting match:', deleteError)
        return false
      }

      return true
    } catch (error) {
      console.error('Error deleting match:', error)
      return false
    }
  }

  // Редактирование матча
  async updateMatch(
    matchId: number,
    newMatchPlayers: { playerId: number; position: number }[],
  ): Promise<boolean> {
    try {
      // Сначала получаем старые данные матча
      const { data: oldMatchData, error: oldMatchError } = await supabase
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
        .eq('id', matchId)
        .single()

      if (oldMatchError) {
        console.error('Error fetching old match data:', oldMatchError)
        return false
      }

      // Откатываем старую статистику
      for (const mp of oldMatchData.match_players) {
        const { data: playerData, error: playerFetchError } = await supabase
          .from('players')
          .select('wins, points')
          .eq('id', mp.player_id)
          .single()

        if (playerFetchError) continue

        const newWins = mp.position === 1 ? Math.max(0, playerData.wins - 1) : playerData.wins
        const newPoints = Math.max(0, Number(playerData.points) - mp.points_earned)

        await this.updatePlayerStats(mp.player_id, newWins, newPoints)
      }

      // Удаляем старые записи match_players
      await supabase.from('match_players').delete().eq('match_id', matchId)

      // Функция для вычисления очков
      const calculatePoints = (
        position: number,
        players: { playerId: number; position: number }[],
      ): number => {
        const playersAtPosition = players.filter((p) => p.position === position).length

        if (position === 1) {
          if (playersAtPosition === 1) return 3
          if (playersAtPosition === 2) return 2
          return 2
        }

        if (position === 2) {
          if (playersAtPosition === 1) return 1
          if (playersAtPosition === 2) return 0.5
          return 0
        }

        return 0
      }

      // Создаем новые записи match_players
      const newMatchPlayerInserts = newMatchPlayers.map((mp) => ({
        match_id: matchId,
        player_id: mp.playerId,
        position: mp.position,
        points_earned: calculatePoints(mp.position, newMatchPlayers),
      }))

      const { error: insertError } = await supabase
        .from('match_players')
        .insert(newMatchPlayerInserts)

      if (insertError) {
        console.error('Error inserting new match players:', insertError)
        return false
      }

      // Применяем новую статистику
      for (const mp of newMatchPlayers) {
        const { data: playerData, error: playerFetchError } = await supabase
          .from('players')
          .select('wins, points')
          .eq('id', mp.playerId)
          .single()

        if (playerFetchError) continue

        const newWins = mp.position === 1 ? playerData.wins + 1 : playerData.wins
        const newPoints = Number(playerData.points) + calculatePoints(mp.position, newMatchPlayers)

        await this.updatePlayerStats(mp.playerId, newWins, newPoints)
      }

      return true
    } catch (error) {
      console.error('Error updating match:', error)
      return false
    }
  }

  // Редактирование игрока
  async updatePlayerName(playerId: number, newName: string): Promise<boolean> {
    const { error } = await supabase.from('players').update({ name: newName }).eq('id', playerId)

    if (error) {
      console.error('Error updating player name:', error)
      return false
    }

    return true
  }

  // Редактирование сезона
  async updateSeasonName(seasonId: number, newName: string): Promise<boolean> {
    const { error } = await supabase.from('seasons').update({ name: newName }).eq('id', seasonId)

    if (error) {
      console.error('Error updating season name:', error)
      return false
    }

    return true
  }

  // Очистка всех данных
  async clearAllData(): Promise<boolean> {
    try {
      // Удаляем все сезоны (каскадно удалятся все связанные данные)
      const { error } = await supabase.from('seasons').delete().neq('id', 0) // удаляем все записи

      if (error) {
        console.error('Error clearing data:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error clearing data:', error)
      return false
    }
  }
}

export const scoreboardService = new ScoreboardService()
