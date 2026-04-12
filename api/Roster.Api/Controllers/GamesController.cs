namespace Roster.Api.Controllers;

using MediatR;
using Microsoft.AspNetCore.Mvc;
using Roster.Application.Commands.AssignInningFielding;
using Roster.Application.Commands.CreateGame;
using Roster.Application.Commands.LockGame;
using Roster.Application.Commands.MarkPlayerAbsent;
using Roster.Application.Commands.RevokePlayerAbsence;
using Roster.Application.Commands.SetBattingOrder;
using Roster.Application.Queries.GetGame;

[Route("teams/{teamId:guid}/games")]
public class GamesController : BaseController
{
    private readonly IMediator _mediator;
    public GamesController(IMediator mediator) => _mediator = mediator;

    /// <summary>List all games for the team.</summary>
    /// <remarks>
    /// Returns a summary of all games including date, opponent, number of innings, lock status, and absent players.
    /// Requires X-Team-Secret header authentication.
    /// </remarks>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<GameSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetGames(Guid teamId, CancellationToken ct)
    {
        if (ResolvedTeamId != teamId) return Forbid();
        return Ok(await _mediator.Send(new GetGamesQuery(teamId), ct));
    }

    /// <summary>Create a new game record.</summary>
    /// <remarks>
    /// Schedules a new game with the specified date, opponent name, and number of innings.
    /// New games are unlocked and ready for lineup setup. Default inning count is 6 if not specified.
    /// Requires X-Team-Secret header authentication.
    /// </remarks>
    [HttpPost]
    [ProducesResponseType(typeof(GameDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CreateGame(Guid teamId, [FromBody] CreateGameRequest request, CancellationToken ct)
    {
        if (ResolvedTeamId != teamId) return Forbid();
        var result = await _mediator.Send(new CreateGameCommand(teamId, request.Date, request.Opponent, request.InningCount), ct);
        var game = await _mediator.Send(new GetGameQuery(result.GameId), ct);
        return StatusCode(201, game);
    }

    /// <summary>Get game details including lineups and fielding assignments.</summary>
    /// <remarks>
    /// Returns complete game information including batting order, fielding assignments for each inning,
    /// absent players, and lock status.
    /// Requires X-Team-Secret header authentication.
    /// </remarks>
    [HttpGet("{gameId:guid}")]
    [ProducesResponseType(typeof(GameDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetGame(Guid teamId, Guid gameId, CancellationToken ct)
    {
        if (ResolvedTeamId != teamId) return Forbid();
        var result = await _mediator.Send(new GetGameQuery(gameId), ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Mark a player as absent for a game.</summary>
    /// <remarks>
    /// Marks an active player as absent for this specific game. Absent players cannot be included
    /// in the batting order or fielding assignments. Cannot be done on locked games.
    /// Requires X-Team-Secret header authentication.
    /// </remarks>
    [HttpPost("{gameId:guid}/absent")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> MarkAbsent(Guid teamId, Guid gameId, [FromBody] MarkAbsentRequest request, CancellationToken ct)
    {
        if (ResolvedTeamId != teamId) return Forbid();
        await _mediator.Send(new MarkPlayerAbsentCommand(teamId, gameId, request.PlayerId), ct);
        return NoContent();
    }

    /// <summary>Remove absence marking from a player for a game.</summary>
    /// <remarks>
    /// Clears the absence marking for a player, making them available again for the batting order
    /// and fielding assignments. Cannot be done on locked games.
    /// Requires X-Team-Secret header authentication.
    /// </remarks>
    [HttpDelete("{gameId:guid}/absent/{playerId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RevokeAbsence(Guid teamId, Guid gameId, Guid playerId, CancellationToken ct)
    {
        if (ResolvedTeamId != teamId) return Forbid();
        await _mediator.Send(new RevokePlayerAbsenceCommand(teamId, gameId, playerId), ct);
        return NoContent();
    }

    /// <summary>Set the batting order for a game.</summary>
    /// <remarks>
    /// Replaces the entire batting order with the provided list of player IDs. All players must be
    /// active and non-absent. No duplicates allowed. Cannot be done on locked games.
    /// Requires X-Team-Secret header authentication.
    /// </remarks>
    [HttpPut("{gameId:guid}/batting-order")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SetBattingOrder(Guid teamId, Guid gameId, [FromBody] SetBattingOrderRequest request, CancellationToken ct)
    {
        if (ResolvedTeamId != teamId) return Forbid();
        await _mediator.Send(new SetBattingOrderCommand(teamId, gameId, request.OrderedPlayerIds), ct);
        return NoContent();
    }

    /// <summary>Assign fielding positions for an inning.</summary>
    /// <remarks>
    /// Sets the complete fielding lineup for a specific inning. Each active, non-absent player must be
    /// assigned exactly once to a position. No two players can share the same non-Bench position.
    /// Bench positions can have multiple players. Cannot be done on locked games.
    /// Requires X-Team-Secret header authentication.
    /// </remarks>
    [HttpPut("{gameId:guid}/innings/{inningNumber:int}/fielding")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AssignFielding(Guid teamId, Guid gameId, int inningNumber, [FromBody] AssignFieldingRequest request, CancellationToken ct)
    {
        if (ResolvedTeamId != teamId) return Forbid();
        var assignments = request.Assignments
            .Select(a => new FieldingAssignmentDto(a.PlayerId, a.Position))
            .ToList();
        await _mediator.Send(new AssignInningFieldingCommand(teamId, gameId, inningNumber, assignments), ct);
        return NoContent();
    }

    /// <summary>Lock the game as final.</summary>
    /// <remarks>
    /// Permanently marks this game as complete and locks it from further editing. This action cannot be undone.
    /// Once locked, no changes can be made to the batting order, fielding assignments, or player absence status.
    /// Requires X-Team-Secret header authentication.
    /// </remarks>
    [HttpPost("{gameId:guid}/lock")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> LockGame(Guid teamId, Guid gameId, CancellationToken ct)
    {
        if (ResolvedTeamId != teamId) return Forbid();
        await _mediator.Send(new LockGameCommand(teamId, gameId), ct);
        return NoContent();
    }
}

public record CreateGameRequest(string Date, string? Opponent, int InningCount = 6);
public record MarkAbsentRequest(Guid PlayerId);
public record SetBattingOrderRequest(IReadOnlyList<Guid> OrderedPlayerIds);
public record AssignFieldingRequest(IReadOnlyList<FieldingSlot> Assignments);
public record FieldingSlot(Guid PlayerId, string Position);
