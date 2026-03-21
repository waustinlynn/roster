namespace Roster.Api.Controllers;

using MediatR;
using Microsoft.AspNetCore.Mvc;
using Roster.Application.Commands.AddPlayer;
using Roster.Application.Commands.DeactivatePlayer;
using Roster.Application.Commands.RatePlayerSkill;
using Roster.Application.Queries.GetRoster;

[Route("teams/{teamId:guid}/players")]
public class PlayersController : BaseController
{
    private readonly IMediator _mediator;
    public PlayersController(IMediator mediator) => _mediator = mediator;

    /// <summary>Lists all players on the roster.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<PlayerDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetRoster(Guid teamId, CancellationToken ct)
    {
        if (ResolvedTeamId != teamId) return Forbid();
        var result = await _mediator.Send(new GetRosterQuery(teamId), ct);
        return Ok(result);
    }

    /// <summary>Adds a player to the roster.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(PlayerResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> AddPlayer(Guid teamId, [FromBody] AddPlayerRequest request, CancellationToken ct)
    {
        if (ResolvedTeamId != teamId) return Forbid();
        var result = await _mediator.Send(new AddPlayerCommand(teamId, request.Name), ct);
        return StatusCode(201, new PlayerResponse(result.PlayerId, request.Name, true, new Dictionary<string, int>()));
    }

    /// <summary>Sets or updates a skill rating for a player.</summary>
    [HttpPut("{playerId:guid}/skills/{skillName}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RateSkill(Guid teamId, Guid playerId, string skillName, [FromBody] RateSkillRequest request, CancellationToken ct)
    {
        if (ResolvedTeamId != teamId) return Forbid();
        await _mediator.Send(new RatePlayerSkillCommand(teamId, playerId, skillName, request.Rating), ct);
        return NoContent();
    }

    /// <summary>Deactivates a player. Historical data preserved.</summary>
    [HttpDelete("{playerId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeactivatePlayer(Guid teamId, Guid playerId, CancellationToken ct)
    {
        if (ResolvedTeamId != teamId) return Forbid();
        await _mediator.Send(new DeactivatePlayerCommand(teamId, playerId), ct);
        return NoContent();
    }
}

public record AddPlayerRequest(string Name);
public record RateSkillRequest(int Rating);
public record PlayerResponse(Guid PlayerId, string Name, bool IsActive, Dictionary<string, int> Skills);
