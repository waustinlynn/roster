namespace Roster.Api.Controllers;

using MediatR;
using Microsoft.AspNetCore.Mvc;
using Roster.Application.Queries.GetBalanceMatrix;

[Route("teams/{teamId:guid}/balance")]
public class BalanceController : BaseController
{
    private readonly IMediator _mediator;
    public BalanceController(IMediator mediator) => _mediator = mediator;

    /// <summary>Returns the cumulative inning-count per player per position across all games.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(BalanceMatrixDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetBalance(Guid teamId, CancellationToken ct)
    {
        if (ResolvedTeamId != teamId) return Forbid();
        var result = await _mediator.Send(new GetBalanceMatrixQuery(teamId), ct);
        return Ok(result);
    }
}
