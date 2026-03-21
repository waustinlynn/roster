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

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<GameSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetGames(Guid teamId, CancellationToken ct)
    {
        if (ResolvedTeamId != teamId) return Forbid();
        return Ok(await _mediator.Send(new GetGamesQuery(teamId), ct));
    }

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
