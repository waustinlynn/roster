namespace Roster.Api.Controllers;

using MediatR;
using Microsoft.AspNetCore.Mvc;
using Roster.Application.Commands.AddPlayer;
using Roster.Application.Commands.DeactivatePlayer;
using Roster.Application.Commands.RatePlayerSkill;
using Roster.Application.Commands.RenamePlayer;
using Roster.Application.Queries.GetRoster;

[Route("teams/{teamId:guid}/players")]
public class PlayersController : BaseController
{
    private readonly IMediator _mediator;
    public PlayersController(IMediator mediator) => _mediator = mediator;

    /// <summary>List all players on the team roster.</summary>
    /// <remarks>
    /// Returns all players on the roster, including both active and inactive players with their skill ratings.
    /// Requires X-Team-Secret header authentication.
    /// </remarks>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<PlayerDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetRoster(Guid teamId, CancellationToken ct)
    {
        if (ResolvedTeamId != teamId) return Forbid();
        var result = await _mediator.Send(new GetRosterQuery(teamId), ct);
        return Ok(result);
    }

    /// <summary>Add a new player to the team roster.</summary>
    /// <remarks>
    /// Creates a new player with no initial skill ratings. The player is active by default.
    /// Requires X-Team-Secret header authentication.
    /// </remarks>
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

    /// <summary>Rate or update a skill for a player (1-5 scale).</summary>
    /// <remarks>
    /// Sets or updates a single skill rating for an active player. Rating must be between 1 and 5 inclusive.
    /// The skill name must be valid for the team's sport.
    /// Requires X-Team-Secret header authentication.
    /// </remarks>
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

    /// <summary>Rename a player.</summary>
    /// <remarks>
    /// Updates the display name for a player. Name must be 1–100 characters.
    /// Requires X-Team-Secret header authentication.
    /// </remarks>
    [HttpPatch("{playerId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RenamePlayer(Guid teamId, Guid playerId, [FromBody] RenamePlayerRequest request, CancellationToken ct)
    {
        if (ResolvedTeamId != teamId) return Forbid();
        await _mediator.Send(new RenamePlayerCommand(teamId, playerId, request.Name), ct);
        return NoContent();
    }

    /// <summary>Deactivate a player and remove them from future games.</summary>
    /// <remarks>
    /// Marks a player as inactive. All historical game data and assignments are preserved.
    /// Inactive players cannot be added to future game lineups or fielding assignments.
    /// Requires X-Team-Secret header authentication.
    /// </remarks>
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
public record RenamePlayerRequest(string Name);
public record RateSkillRequest(int Rating);
public record PlayerResponse(Guid PlayerId, string Name, bool IsActive, Dictionary<string, int> Skills);
