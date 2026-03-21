namespace Roster.Api.Controllers;

using MediatR;
using Microsoft.AspNetCore.Mvc;
using Roster.Application.Commands.CreateTeam;
using Roster.Application.Queries.GetTeam;
using Roster.Domain.Exceptions;

[Route("teams")]
public class TeamsController : BaseController
{
    private readonly IMediator _mediator;

    public TeamsController(IMediator mediator) => _mediator = mediator;

    /// <summary>Creates a new team and returns the one-time access secret.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(CreateTeamResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateTeam([FromBody] CreateTeamRequest request, CancellationToken ct)
    {
        var result = await _mediator.Send(new CreateTeamCommand(request.Name, request.SportName), ct);

        return CreatedAtAction(nameof(GetTeam),
            new { teamId = result.TeamId },
            new CreateTeamResponse(result.TeamId, request.Name, request.SportName, result.AccessSecret));
    }

    /// <summary>Returns team metadata. Requires X-Team-Secret header.</summary>
    [HttpGet("{teamId:guid}")]
    [ProducesResponseType(typeof(GetTeamResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTeam(Guid teamId, CancellationToken ct)
    {
        // Middleware already validated the secret; ensure it matches the route teamId
        if (ResolvedTeamId != teamId) return Forbid();

        var result = await _mediator.Send(new GetTeamQuery(teamId), ct);
        if (result is null) return NotFound();

        return Ok(new GetTeamResponse(
            result.TeamId,
            result.Name,
            result.SportName,
            new SportResponse(result.Sport.Name, result.Sport.Skills, result.Sport.Positions)));
    }
}

// Request/Response DTOs
public record CreateTeamRequest(string Name, string SportName);

public record CreateTeamResponse(
    Guid TeamId,
    string Name,
    string SportName,
    string AccessSecret);

public record GetTeamResponse(
    Guid TeamId,
    string Name,
    string SportName,
    SportResponse Sport);

public record SportResponse(
    string Name,
    IReadOnlyList<string> Skills,
    IReadOnlyList<string> Positions);
