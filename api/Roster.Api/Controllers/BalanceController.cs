namespace Roster.Api.Controllers;

using MediatR;
using Microsoft.AspNetCore.Mvc;
using Roster.Application.Queries.GetBalanceMatrix;

[Route("teams/{teamId:guid}/balance")]
public class BalanceController : BaseController
{
    private readonly IMediator _mediator;
    public BalanceController(IMediator mediator) => _mediator = mediator;

    /// <summary>Get the position balance matrix showing player usage across games.</summary>
    /// <remarks>
    /// Returns a matrix showing the total number of innings each player has been assigned to each position
    /// across all locked games. This helps coaches ensure fair and balanced playing time. Includes both active
    /// and inactive players with zero counts for positions not yet played.
    /// Requires X-Team-Secret header authentication.
    /// </remarks>
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
