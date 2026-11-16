import * as vscode from "vscode";

/**
 * Azure DevOps Authentication Provider using Microsoft Entra OAuth
 * Uses VS Code's built-in Microsoft authentication with the user_impersonation scope
 */
export class AzureDevOpsAuthProvider {
	private static readonly AZURE_DEVOPS_RESOURCE_ID = "499b84ac-1321-427f-aa17-267ca6975798";
	private static readonly SCOPES = [
		`${AzureDevOpsAuthProvider.AZURE_DEVOPS_RESOURCE_ID}/user_impersonation`,
	];

	private currentSession: vscode.AuthenticationSession | null = null;
	private currentAccount: vscode.AuthenticationSessionAccountInformation | undefined;
	private rejectedAccessToken: string | undefined;

	async signIn(): Promise<void> {
		const session = await vscode.authentication.getSession(
			"microsoft",
			AzureDevOpsAuthProvider.SCOPES,
			this.rejectedAccessToken && !this.currentSession
				? { forceNewSession: true, account: this.currentAccount }
				: { createIfNone: true },
		);

		if (!session) {
			throw new Error("Failed to obtain authentication session");
		}

		if (session.accessToken === this.rejectedAccessToken) {
			throw new Error("Microsoft returned an access token that Azure DevOps already rejected");
		}

		this.currentSession = session;
		this.currentAccount = session.account;
	}

	async signOut(): Promise<void> {
		// Clear the current session reference
		// Note: VS Code manages authentication sessions centrally
		// Users can fully sign out through VS Code's Accounts menu
		this.currentSession = null;
		this.currentAccount = undefined;
	}

	async getAccessToken(): Promise<string | null> {
		const previousSession = this.currentSession;
		const session = await vscode.authentication.getSession(
			"microsoft",
			AzureDevOpsAuthProvider.SCOPES,
			{ createIfNone: false, silent: true, account: this.currentAccount },
		);

		if (this.currentSession !== previousSession) {
			return this.currentSession?.accessToken || null;
		}

		if (session?.accessToken && session.accessToken !== this.rejectedAccessToken) {
			this.currentSession = session;
			this.currentAccount = session.account;
		}

		// Silent lookup can return nothing immediately after a successful interactive sign-in.
		// Keep that session until Azure DevOps rejects its token, not just until lookup fails.
		return this.currentSession?.accessToken || null;
	}

	invalidateAccessToken(accessToken: string): void {
		if (this.currentSession?.accessToken === accessToken) {
			this.rejectedAccessToken = accessToken;
			this.currentSession = null;
		}
	}

	async isAuthenticated(): Promise<boolean> {
		const token = await this.getAccessToken();
		return token !== null;
	}
}
